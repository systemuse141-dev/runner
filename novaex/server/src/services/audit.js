// Append-only audit system. Every privileged action records actor, role,
// action, target, old/new state, reason, timestamp, request metadata and
// approval info. The store physically rejects updates/deletes on audit_logs.

export class AuditService {
  constructor(store, bus) {
    this.store = store;
    this.bus = bus; // ws hub (optional)
  }

  async record({ actor, role, action, targetType = null, targetId = null, oldState = null, newState = null, reason = null, requestMeta = null, approvalId = null, forceTs = null }) {
    const entry = await this.store.insert('audit_logs', {
      id: `AUD-${String(await this.store.nextSeq('audit')).padStart(6, '0')}`,
      actor,
      role,
      action,
      target_type: targetType,
      target_id: targetId,
      old_state: oldState,
      new_state: newState,
      reason,
      request_meta: requestMeta,
      approval_id: approvalId,
      ts: forceTs ?? Date.now(),
    });
    this.bus?.pushOps({ kind: 'audit', data: entry });
    return entry;
  }

  /** Operator intervention wrapper: operator_actions + audit_logs together. */
  async operatorAction({ actor, role, action, entityType, entityId, reason = null, result, approvalId = null, oldState = null, newState = null, requestMeta = null }) {
    const op = await this.store.insert('operator_actions', {
      id: crypto.randomUUID(),
      actor,
      actor_role: role,
      action,
      entity_type: entityType,
      entity_id: entityId,
      reason,
      result,
      approval_id: approvalId,
      ts: Date.now(),
    });
    const audit = await this.record({
      actor, role, action, targetType: entityType, targetId: entityId,
      oldState, newState, reason, requestMeta, approvalId,
    });
    this.bus?.pushOps({ kind: 'operator_action', data: { ...op, audit_id: audit.id } });
    return { op, audit };
  }

  query(filters = {}) {
    const opts = { order: 'ts', dir: 'desc', limit: Math.min(Number(filters.limit ?? 100), 500), offset: Number(filters.offset ?? 0) };
    const eq = {};
    if (filters.actor) eq.actor = filters.actor;
    if (filters.role) eq.role = filters.role;
    if (filters.action) eq.action = filters.action;
    if (filters.target_type) eq.target_type = filters.target_type;
    if (filters.target_id) eq.target_id = filters.target_id;
    if (filters.from) opts.gte = { ts: Number(filters.from) };
    if (filters.to) opts.lte = { ts: Number(filters.to) };
    if (Object.keys(eq).length) opts.eq = eq;
    return this.store.all('audit_logs', opts);
  }
}
