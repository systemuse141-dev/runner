// Risk service: deterministic rule evaluation + event recording + alerts.
// AI may explain these events; it can never invent them.

import { assessRisk, RISK_RULES, RISK_LEVELS, levelRank } from '../domain/risk.js';

export class RiskService {
  constructor(store, bus) {
    this.store = store;
    this.bus = bus;
  }

  /** Evaluate rules and persist the event. */
  async record({ type, entityType, entityId, userId = null, ctx = {}, extra = {} }) {
    const res = assessRisk(ctx);
    const ev = await this.store.insert('risk_events', {
      id: `RISK-${String(await this.store.nextSeq('risk')).padStart(5, '0')}`,
      type,
      entity_type: entityType,
      entity_id: entityId,
      user_id: userId,
      level: res.level,
      score: res.score,
      rules: res.rules,
      data: { ...ctx, ...extra },
      status: 'OPEN',
      resolved_by: null,
      ts: Date.now(),
      updated_at: Date.now(),
    });
    if (levelRank(res.level) >= 2) {
      this.bus?.pushOps({ kind: 'risk_event', data: ev });
    }
    return ev;
  }

  async resolve(id, by, role, note = null) {
    const ev = await this.store.get('risk_events', id);
    if (!ev) return null;
    await this.store.update('risk_events', id, { status: 'RESOLVED', resolved_by: by, updated_at: Date.now() });
    this.bus?.pushOps({ kind: 'risk_resolved', data: { id, by } });
    return { ...ev, status: 'RESOLVED', resolved_by: by, resolution_note: note };
  }

  query(filters = {}) {
    const opts = { order: 'ts', dir: 'desc', limit: Math.min(Number(filters.limit ?? 100), 500) };
    const eq = {};
    if (filters.status) eq.status = filters.status;
    if (filters.level) eq.level = filters.level;
    if (filters.type) eq.type = filters.type;
    if (filters.entity_id) eq.entity_id = filters.entity_id;
    if (filters.user_id) eq.user_id = filters.user_id;
    if (filters.from) opts.gte = { ts: Number(filters.from) };
    if (filters.to) opts.lte = { ts: Number(filters.to) };
    if (Object.keys(eq).length) opts.eq = eq;
    return this.store.all('risk_events', opts);
  }

  /** Counts for the operator overview. */
  async stats() {
    const open = await this.query({ status: 'OPEN' });
    const by = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const e of open) by[e.level] = (by[e.level] ?? 0) + 1;
    return { openTotal: open.length, byLevel: by, criticalOpen: by.CRITICAL };
  }

  rules() {
    return Object.values(RISK_RULES).map(({ id, name, severity, description }) => ({ id, name, severity, description }));
  }
}
