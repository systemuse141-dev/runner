// In-memory table engine shared by the demo file store and tests.
// Synchronous, JSON-safe rows, append-only enforcement, seq counters, meta.

import { APPEND_ONLY_TABLES } from '../../../shared/contracts.js';

export class AppendOnlyError extends Error {
  constructor(table) {
    super(`Table "${table}" is append-only`);
    this.name = 'AppendOnlyError';
    this.code = 'APPEND_ONLY';
    this.status = 500;
  }
}

function match(row, opts) {
  if (!opts) return true;
  if (opts.eq) for (const [k, v] of Object.entries(opts.eq)) if (row[k] !== v) return false;
  if (opts.in) for (const [k, vals] of Object.entries(opts.in)) if (!vals.includes(row[k])) return false;
  if (opts.gt) for (const [k, v] of Object.entries(opts.gt)) if (!(row[k] > v)) return false;
  if (opts.gte) for (const [k, v] of Object.entries(opts.gte)) if (!(row[k] >= v)) return false;
  if (opts.lt) for (const [k, v] of Object.entries(opts.lt)) if (!(row[k] < v)) return false;
  if (opts.lte) for (const [k, v] of Object.entries(opts.lte)) if (!(row[k] <= v)) return false;
  if (opts.like) for (const [k, v] of Object.entries(opts.like)) {
    const cell = row[k];
    if (typeof cell !== 'string' || !cell.toLowerCase().includes(v.toLowerCase())) return false;
  }
  if (opts.custom) for (const fn of opts.custom) if (!fn(row)) return false;
  return true;
}

export class MemoryDB {
  constructor({ persist = null } = {}) {
    this.tables = new Map();
    this.meta = new Map();
    this.seqs = new Map();
    this.persist = persist; // fn(state) | null
    this._persistTimer = null;
  }

  table(name) {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name);
  }

  nextSeq(name) {
    const n = (this.seqs.get(name) ?? 0) + 1;
    this.seqs.set(name, n);
    this._schedulePersist();
    return n;
  }

  setSeq(name, n) {
    this.seqs.set(name, n);
    this._schedulePersist();
  }

  metaGet(key, def = null) {
    return this.meta.has(key) ? this.meta.get(key) : def;
  }

  metaSet(key, value) {
    this.meta.set(key, value);
    this._schedulePersist();
  }

  insert(table, row) {
    const t = this.table(table);
    const rowId = row.id ?? crypto.randomUUID();
    const full = { ...row, id: rowId, created_at: row.created_at ?? Date.now() };
    t.set(rowId, full);
    this._schedulePersist();
    return { ...full };
  }

  get(table, id) {
    const row = this.table(table).get(id);
    return row ? { ...row } : null;
  }

  update(table, id, patch) {
    if (APPEND_ONLY_TABLES.has(table)) throw new AppendOnlyError(table);
    const t = this.table(table);
    const row = t.get(id);
    if (!row) return null;
    const next = { ...row, ...patch, id, updated_at: Date.now() };
    t.set(id, next);
    this._schedulePersist();
    return { ...next };
  }

  remove(table, id) {
    if (APPEND_ONLY_TABLES.has(table)) throw new AppendOnlyError(table);
    const ok = this.table(table).delete(id);
    this._schedulePersist();
    return ok;
  }

  /** Query: { eq, in, gt, gte, lt, lte, like, custom[], order, dir, limit, offset } */
  all(table, opts = {}) {
    const rows = [...this.table(table).values()].filter((r) => match(r, opts));
    if (opts.order) {
      const keys = Array.isArray(opts.order) ? opts.order : [opts.order];
      const dir = opts.dir === 'desc' ? -1 : 1;
      rows.sort((a, b) => {
        for (const k of keys) {
          if (a[k] === b[k]) continue;
          return (a[k] < b[k] ? -1 : 1) * dir;
        }
        return 0;
      });
    }
    const start = opts.offset ?? 0;
    const end = opts.limit != null ? start + opts.limit : rows.length;
    return rows.slice(start, end).map((r) => ({ ...r }));
  }

  count(table, opts = {}) {
    return [...this.table(table).values()].filter((r) => match(r, opts)).length;
  }

  /** Atomic transaction: synchronous engine, so this is a straight run. */
  tx(fn) {
    const out = fn(this);
    this._schedulePersist();
    return out;
  }

  _schedulePersist() {
    if (!this.persist) return;
    if (this._persistTimer) return;
    this._persistTimer = setTimeout(() => {
      this._persistTimer = null;
      try {
        this.persist(this._state());
      } catch (e) {
        console.error('[store] persist failed', e.message);
      }
    }, 300);
    this._persistTimer.unref?.();
  }

  _state() {
    return {
      tables: Object.fromEntries([...this.tables.entries()].map(([k, v]) => [k, [...v.values()]])),
      meta: Object.fromEntries(this.meta),
      seqs: Object.fromEntries(this.seqs),
    };
  }

  restore(state) {
    if (!state) return;
    this.tables = new Map(Object.entries(state.tables ?? {}).map(([k, rows]) => [k, new Map(rows.map((r) => [r.id, r]))]));
    this.meta = new Map(state.meta ?? {});
    this.seqs = new Map(state.seqs ?? {});
  }

  flush() {
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
    }
    if (this.persist) {
      try {
        this.persist(this._state());
      } catch (e) {
        console.error('[store] flush failed', e.message);
      }
    }
  }
}
