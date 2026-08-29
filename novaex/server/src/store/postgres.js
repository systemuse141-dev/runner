// PostgreSQL store implementing the same interface as the in-memory engine.
// Active when DATABASE_URL is set (production mode). See schema.sql.
// Flexible columns (meta, rules, ...) are stored as JSONB.

import pg from 'pg';
import { APPEND_ONLY_TABLES } from '../../../shared/contracts.js';

const JSON_COLS = new Set([
  'meta', 'rules', 'data', 'approvals', 'rejections', 'approvers', 'old_state',
  'new_state', 'request_meta', 'execution_result', 'spark', 'series', 'result',
  'context', 'blocks', 'evidence', 'checks',
]);

function enc(v) {
  if (v == null) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

export function createPostgresStore({ connectionString, schemaFile }) {
  const pool = new pg.Pool({ connectionString, max: 10 });

  async function init() {
    if (schemaFile) {
      const { readFileSync } = await import('node:fs');
      await pool.query(readFileSync(schemaFile, 'utf8'));
    }
  }

  const db = {
    pool,
    init() {
      return init();
    },

    setSeq(name, n) {
      return db.metaSet(`seq:${name}`, n);
    },

    async nextSeq(name) {
      const r = await pool.query(
        `INSERT INTO meta (key, value) VALUES ($1, 1)
         ON CONFLICT (key) DO UPDATE SET value = meta.value + 1
         RETURNING value`,
        [`seq:${name}`]
      );
      return Number(r.rows[0].value);
    },

    async metaGet(key, def = null) {
      const r = await pool.query('SELECT value FROM meta WHERE key = $1', [key]);
      if (!r.rows.length) return def;
      const v = r.rows[0].value;
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    },

    async metaSet(key, value) {
      await pool.query(
        'INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [key, JSON.stringify(value ?? null)]
      );
    },

    async insert(table, row) {
      const cols = Object.keys(row);
      const vals = cols.map((c) => enc(row[c]));
      const ids = cols.map((_, i) => `$${i + 1}`);
      const r = await pool.query(
        `INSERT INTO ${table} (${cols.join(',')}) VALUES (${ids.join(',')}) RETURNING *`,
        vals
      );
      return r.rows[0];
    },

    async get(table, id) {
      const r = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
      return r.rows[0] ?? null;
    },

    async update(table, id, patch) {
      if (APPEND_ONLY_TABLES.has(table)) {
        const e = new Error(`Table "${table}" is append-only`);
        e.code = 'APPEND_ONLY';
        throw e;
      }
      const cols = Object.keys(patch).filter((c) => c !== 'id');
      if (!cols.length) return this.get(table, id);
      const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
      const vals = cols.map((c) => enc(patch[c]));
      vals.push(Date.now(), id);
      const r = await pool.query(
        `UPDATE ${table} SET ${sets}, updated_at = $${vals.length - 1} WHERE id = $${vals.length} RETURNING *`,
        vals
      );
      return r.rows[0] ?? null;
    },

    async remove(table, id) {
      if (APPEND_ONLY_TABLES.has(table)) {
        const e = new Error(`Table "${table}" is append-only`);
        e.code = 'APPEND_ONLY';
        throw e;
      }
      await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    },

    async all(table, opts = {}) {
      const where = [];
      const vals = [];
      const add = (clause, ...v) => {
        vals.push(...v);
        where.push(clause.replace(/\?/g, () => `$${vals.length}`));
      };
      if (opts.eq) for (const [k, v] of Object.entries(opts.eq)) add(`${k} = ?`, enc(v));
      if (opts.in) for (const [k, v] of Object.entries(opts.in)) add(`${k} = ANY(?)`, v);
      if (opts.gt) for (const [k, v] of Object.entries(opts.gt)) add(`${k} > ?`, v);
      if (opts.gte) for (const [k, v] of Object.entries(opts.gte)) add(`${k} >= ?`, v);
      if (opts.lt) for (const [k, v] of Object.entries(opts.lt)) add(`${k} < ?`, v);
      if (opts.lte) for (const [k, v] of Object.entries(opts.lte)) add(`${k} <= ?`, v);
      if (opts.like) for (const [k, v] of Object.entries(opts.like)) add(`LOWER(${k}) LIKE ?`, `%${String(v).toLowerCase()}%`);
      const sql = `SELECT * FROM ${table}` +
        (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
        (opts.order ? ` ORDER BY ${Array.isArray(opts.order) ? opts.order.join(',') : opts.order} ${opts.dir === 'desc' ? 'DESC' : 'ASC'}` : '') +
        (opts.limit != null ? ' LIMIT $LIM' : '');
      let q = sql;
      if (opts.limit != null) {
        vals.push(opts.limit);
        q = q.replace('$LIM', `$${vals.length}`);
      }
      if (opts.offset != null) {
        vals.push(opts.offset);
        q = `SELECT * FROM (${q}) sub OFFSET $${vals.length}`;
      }
      const r = await pool.query(q, vals);
      return r.rows;
    },

    async count(table, opts = {}) {
      const all = await this.all(table, { ...opts, limit: null });
      return all.length;
    },

    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const scoped = new Proxy(db, {
          get(target, prop) {
            const v = target[prop];
            if (typeof v === 'function' && !['tx', 'init', 'close'].includes(prop)) {
              return async (...args) => {
                // run raw SQL against the transactional client is complex;
                // instead serialize: execute on pool inside the open tx is NOT
                // possible, so we temporarily swap the pool's client via a
                // connection-level override.
                return target._txCall(client, prop, args);
              };
            }
            return typeof v === 'function' ? v.bind(target) : v;
          },
        });
        const out = await fn(scoped);
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
  };

  // Transactional execution: raw operations bound to the pooled client.
  const raw = {
    nextSeq: (client, name) =>
      client.query(
        `INSERT INTO meta (key, value) VALUES ($1, 1) ON CONFLICT (key) DO UPDATE SET value = meta.value + 1 RETURNING value`,
        [`seq:${name}`]
      ).then((r) => Number(r.rows[0].value)),
    insert: (client, table, row) => {
      const cols = Object.keys(row);
      const vals = cols.map((c) => enc(row[c]));
      return client
        .query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, vals)
        .then((r) => r.rows[0]);
    },
    get: (client, table, id) => client.query(`SELECT * FROM ${table} WHERE id = $1`, [id]).then((r) => r.rows[0] ?? null),
    update: (client, table, id, patch) => {
      const cols = Object.keys(patch).filter((c) => c !== 'id');
      if (!cols.length) return raw.get(client, table, id);
      const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
      const vals = cols.map((c) => enc(patch[c]));
      vals.push(Date.now(), id);
      return client
        .query(`UPDATE ${table} SET ${sets}, updated_at = $${vals.length - 1} WHERE id = $${vals.length} RETURNING *`, vals)
        .then((r) => r.rows[0] ?? null);
    },
    all: async (client, table, opts = {}) => {
      const where = [];
      const vals = [];
      const add = (clause, ...v) => {
        vals.push(...v);
        where.push(clause.replace(/\?/g, () => `$${vals.length}`));
      };
      if (opts.eq) for (const [k, v] of Object.entries(opts.eq)) add(`${k} = ?`, enc(v));
      if (opts.in) for (const [k, v] of Object.entries(opts.in)) add(`${k} = ANY(?)`, v);
      if (opts.gt) for (const [k, v] of Object.entries(opts.gt)) add(`${k} > ?`, v);
      if (opts.gte) for (const [k, v] of Object.entries(opts.gte)) add(`${k} >= ?`, v);
      if (opts.lt) for (const [k, v] of Object.entries(opts.lt)) add(`${k} < ?`, v);
      if (opts.lte) for (const [k, v] of Object.entries(opts.lte)) add(`${k} <= ?`, v);
      if (opts.like) for (const [k, v] of Object.entries(opts.like)) add(`LOWER(${k}) LIKE ?`, `%${String(v).toLowerCase()}%`);
      let sql = `SELECT * FROM ${table}`;
      if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
      if (opts.order) sql += ` ORDER BY ${Array.isArray(opts.order) ? opts.order.join(',') : opts.order} ${opts.dir === 'desc' ? 'DESC' : 'ASC'}`;
      if (opts.limit != null) {
        vals.push(opts.limit);
        sql += ` LIMIT $${vals.length}`;
      }
      let r = await client.query(sql, vals);
      if (opts.offset != null) {
        const off = r.rows.slice(0, opts.offset).length; // in-memory offset (simple)
        r = { rows: r.rows.slice(opts.offset) };
        void off;
      }
      return r.rows;
    },
  };
  db._txCall = async (client, prop, args) => {
    if (prop === 'nextSeq') return raw.nextSeq(client, args[0]);
    if (prop === 'insert') return raw.insert(client, args[0], args[1]);
    if (prop === 'get') return raw.get(client, args[0], args[1]);
    if (prop === 'update') return raw.update(client, args[0], args[1], args[2]);
    if (prop === 'all') return raw.all(client, args[0], args[1] ?? {});
    if (prop === 'count') {
      const rows = await raw.all(client, args[0], args[1] ?? {});
      return rows.length;
    }
    if (prop === 'metaGet') {
      const r = await client.query('SELECT value FROM meta WHERE key = $1', [args[0]]);
      if (!r.rows.length) return args[1] ?? null;
      try {
        return JSON.parse(r.rows[0].value);
      } catch {
        return r.rows[0].value;
      }
    }
    if (prop === 'metaSet') {
      await client.query(
        'INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [args[0], JSON.stringify(args[1] ?? null)]
      );
      return;
    }
    throw new Error(`No transactional implementation for ${prop}`);
  };

  db.close = async () => pool.end();
  return db;
}
