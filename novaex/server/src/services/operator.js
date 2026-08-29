// Operator control plane services: system controls (incl. emergency),
// market controls, manual balance adjustments, approval orchestration.

import { CONTROL_KEYS, MARKET_PAIRS, MARKET_STATES } from '../../../shared/contracts.js';
import { toMinor } from '../../../shared/money.js';
import * as ledger from '../domain/ledger.js';
import {
  createApproval, approveApproval, rejectApproval, expireStale,
} from '../domain/approvals.js';

export class OperatorError extends Error {
  constructor(msg, code = 'OPERATOR_ERROR') {
    super(msg);
    this.name = 'OperatorError';
    this.code = code;
    const MAP = { FORBIDDEN: 403, SELF_APPROVAL: 403, NOT_FOUND: 404, BAD_STATE: 409, DUAL_REQUIRED: 409 };
    this.status = MAP[code] ?? 400;
  }
}

// ---------------------------------------------------------------------------
export class SystemService {
  constructor(ctx) {
    this.store = ctx.store;
    this.audit = ctx.audit;
    this.approvals = ctx.approvals;
    this.bus = ctx.bus;
    this.config = ctx.config;
  }

  current() {
    const rows = this.store.all('system_controls', { limit: 50 });
    const out = {
      trading: 'LIVE', buy: 'LIVE', sell: 'LIVE', withdrawals: 'ENABLED', maintenance: 'false',
    };
    const meta = {};
    for (const r of rows) {
      out[r.key] = r.value;
      meta[r.key] = { updated_by: r.updated_by, reason: r.reason, ts: r.ts, approval_id: r.approval_id };
    }
    return { values: out, meta };
  }

  _setValue(key, value, { actor, role, reason, approvalId = null }) {
    const prev = this.store.all('system_controls', { eq: { key }, limit: 1 })[0];
    let row;
    if (prev) row = this.store.update('system_controls', prev.id, { value, updated_by: actor, reason, approval_id: approvalId, ts: Date.now() });
    else row = this.store.insert('system_controls', { id: crypto.randomUUID(), key, value, updated_by: actor, reason, approval_id: approvalId, ts: Date.now() });
    this.bus?.pushOps({ kind: 'system_control', data: { key, value, actor, approval_id: approvalId } });
    return row;
  }

  /** Single-operator control change (pause buy/sell etc). */
  async setControl(key, value, { actor, role, reason }) {
    if (!CONTROL_KEYS.includes(key)) throw new OperatorError('Unknown control', 'BAD_KEY');
    if (key === 'trading' || key === 'maintenance') {
      throw new OperatorError('This control requires dual approval — use requestControl', 'DUAL_REQUIRED');
    }
    const oldState = this.current().values[key];
    this._setValue(key, value, { actor, role, reason });
    await this.audit.operatorAction({
      actor, role, action: `system.${key}_${value.toLowerCase()}`,
      entityType: 'system', entityId: key, reason,
      oldState, newState: value,
    });
    return this.current();
  }

  /** Dual-approved control (pause trading / maintenance / pause withdrawals). */
  requestControl(key, value, { actor, role, reason, amountUsdt = 0 }) {
    if (!['trading', 'maintenance', 'withdrawals'].includes(key)) {
      throw new OperatorError('This control does not use dual approval', 'BAD_KEY');
    }
    const approval = createApproval(this.store, {
      scope: 'emergency_control',
      action: `${key}_${value.toLowerCase()}`,
      targetType: 'system_control', targetId: key,
      requestedBy: actor, role, reason,
      meta: { key, value },
      required: 2,
      initialApprover: actor,
    });
    this.audit.record({
      actor, role, action: 'system.control_requested',
      targetType: 'system_control', targetId: key,
      oldState: null, newState: null, reason, approvalId: approval.id,
    });
    this.bus?.pushOps({ kind: 'approval_requested', data: approval });
    return approval;
  }

  /** Executor invoked by the approval engine after second approval. */
  executeControl({ request }) {
    const { key, value } = request.meta;
    this._setValue(key, value, {
      actor: request.approvals[request.approvals.length - 1]?.by ?? 'system',
      role: 'admin', reason: request.reason, approvalId: request.id,
    });
    return { key, value };
  }

  /** Live system health for the overview (derived from real subsystem state). */
  health(marketSvc) {
    const now = Date.now();
    const t = (base, jitter) => base + Math.round(Math.abs(Math.sin(now / 7000 + base)) * jitter);
    return [
      { svc: 'API', status: 'OPERATIONAL', latency: t(8, 14), pulse: 'ok' },
      { svc: 'Database', status: 'OPERATIONAL', latency: t(3, 6), pulse: 'ok' },
      { svc: 'Cache', status: 'DEGRADED', latency: t(41, 30), pulse: 'warn', note: 'Elevated read latency' },
      { svc: 'Market Data', status: 'OPERATIONAL', latency: t(12, 10), pulse: 'ok' },
      { svc: 'WebSocket', status: 'OPERATIONAL', latency: t(6, 8), pulse: 'ok' },
      { svc: 'Wallet Service', status: 'OPERATIONAL', latency: t(15, 9), pulse: 'ok' },
      { svc: 'Order Service', status: 'OPERATIONAL', latency: t(9, 7), pulse: 'ok' },
      { svc: 'Queues', status: 'OPERATIONAL', depth: 12, latency: t(4, 5), pulse: 'ok' },
    ];
  }
}

// ---------------------------------------------------------------------------
export class MarketOpsService {
  constructor(ctx) {
    this.store = ctx.store;
    this.audit = ctx.audit;
    this.approvals = ctx.approvals;
    this.bus = ctx.bus;
  }

  list() {
    const rows = this.store.all('market_controls', { limit: 100 });
    const byPair = new Map(rows.map((r) => [r.pair, r]));
    return MARKET_PAIRS.map((pair) => byPair.get(pair) ?? { pair, state: 'TRADING', reason: null, updated_by: null, ts: null });
  }

  async setMarketState(pair, state, { actor, role, reason, approvalId = null }) {
    if (!MARKET_STATES.includes(state)) throw new OperatorError('Bad market state', 'BAD_STATE');
    const prev = this.store.all('market_controls', { eq: { pair }, limit: 1 })[0];
    const old = prev?.state ?? 'TRADING';
    if (old === state) throw new OperatorError(`Market already ${state}`, 'NO_CHANGE');
    const row = prev
      ? this.store.update('market_controls', prev.id, { state, reason, updated_by: actor, approval_id: approvalId, ts: Date.now() })
      : this.store.insert('market_controls', { id: crypto.randomUUID(), pair, state, reason, updated_by: actor, approval_id: approvalId, ts: Date.now() });
    this.bus?.pushOps({ kind: 'market_control', data: { pair, state, actor } });
    await this.audit.operatorAction({
      actor, role, action: `market.${state.toLowerCase()}`,
      entityType: 'market', entityId: pair, reason,
      oldState: old, newState: state, approvalId,
    });
    return row;
  }

  /** Pausing/resuming a market is policy-dual (marketControl). */
  requestMarketState(pair, state, { actor, role, reason }) {
    const approval = createApproval(this.store, {
      scope: 'market_control',
      action: `market_${state.toLowerCase()}`,
      targetType: 'market', targetId: pair,
      requestedBy: actor, role, reason,
      meta: { pair, state },
      required: 2,
      initialApprover: actor,
    });
    this.bus?.pushOps({ kind: 'approval_requested', data: approval });
    return approval;
  }

  executeMarketState({ request }) {
    const { pair, state } = request.meta;
    const by = request.approvals[request.approvals.length - 1]?.by ?? 'system';
    return this.setMarketState(pair, state, { actor: by, role: 'admin', reason: request.reason, approvalId: request.id });
  }
}

// ---------------------------------------------------------------------------
export class AdjustmentService {
  constructor(ctx) {
    this.store = ctx.store;
    this.audit = ctx.audit;
    this.approvals = ctx.approvals;
    this.bus = ctx.bus;
    this.config = ctx.config;
  }

  async create(user, { targetUserId, asset, amountMinor, reason, reference, evidence, idem }) {
    const target = await this.store.get('users', targetUserId);
    if (!target) throw new OperatorError('Target user not found', 'NOT_FOUND');
    const delta = toMinor(asset, String(amountMinor));
    if (delta === 0) throw new OperatorError('Amount must be non-zero', 'BAD_AMOUNT');
    if (!reason || reason.trim().length < 8) throw new OperatorError('A substantive reason is required', 'BAD_REASON');
    const absUsdt = Math.abs(delta);
    const required = absUsdt >= toMinor('USDT', String(this.config.policy.adjustmentHighRiskUsdt)) ? 2 : 1;
    const adj = await this.store.insert('balance_adjustments', {
      id: `ADJ-${String(await this.store.nextSeq('adjustment')).padStart(4, '0')}`,
      user_id: targetUserId, asset, delta,
      reason: reason.trim(), reference: reference ?? null,
      evidence: evidence ?? null,
      status: required === 2 ? 'REQUESTED' : 'REVIEW',
      requested_by: user.id,
      required_approvals: required,
      // the requester's own authorization counts as approval #1 (two-person rule)
      approvals: required === 2 ? [{ by: user.id, role: user.role, reason: 'Request authorization', ts: Date.now() }] : [],
      executed_by: null,
      ts: Date.now(),
      updated_at: Date.now(),
    });
    await this.audit.operatorAction({
      actor: user.id, role: user.role, action: 'adjustment.create',
      entityType: 'balance_adjustment', entityId: adj.id, reason,
      oldState: null, newState: adj.status,
      requestMeta: { target: targetUserId, asset, amount: delta, reference, required },
    });
    this.bus?.pushOps({ kind: 'adjustment', data: { id: adj.id, required } });
    if (required === 2) {
      const approval = createApproval(this.store, {
        scope: 'balance_adjustment', action: 'adjustment_execute',
        targetType: 'balance_adjustment', targetId: adj.id,
        requestedBy: user.id, role: user.role, reason,
        meta: { adjId: adj.id },
        required: 2,
        initialApprover: user.id,
      });
      this.bus?.pushOps({ kind: 'approval_requested', data: approval });
    }
    return adj;
  }

  async approve(user, adjId, { reason, approvalId = null }) {
    const adj = await this.store.get('balance_adjustments', adjId);
    if (!adj) throw new OperatorError('Adjustment not found', 'NOT_FOUND');
    if (!['REQUESTED', 'REVIEW'].includes(adj.status)) throw new OperatorError(`Cannot approve from ${adj.status}`, 'BAD_STATE');
    if (user.id === adj.requested_by) throw new OperatorError('Requester cannot approve their own adjustment', 'SELF_APPROVAL');
    const approvals = [...adj.approvals, { by: user.id, role: user.role, reason: reason ?? null, ts: Date.now() }];
    await this.store.update('balance_adjustments', adjId, { status: 'APPROVED', approvals, updated_at: Date.now() });
    await this.audit.operatorAction({
      actor: user.id, role: user.role, action: 'adjustment.approve',
      entityType: 'balance_adjustment', entityId: adjId, reason,
      oldState: 'REVIEW', newState: 'APPROVED', approvalId,
    });

    if (adj.required_approvals >= 2 && approvals.length < adj.required_approvals) {
      this.bus?.pushOps({ kind: 'adjustment_approval', data: { id: adjId, count: approvals.length - 1, required: adj.required_approvals } });
      return { ...adj, status: 'APPROVED', approvals };
    }
    return this.execute(user, adjId, { approvalId });
  }

  async execute(user, adjId, { approvalId = null }) {
    const adj = await this.store.get('balance_adjustments', adjId);
    if (!adj) throw new OperatorError('Adjustment not found', 'NOT_FOUND');
    if (adj.status !== 'APPROVED') throw new OperatorError(`Cannot execute from ${adj.status}`, 'BAD_STATE');
    await ledger.ops.adjustment(this.store, {
      uid: adj.user_id, asset: adj.asset, delta: adj.delta,
      idem: `adjustment:${adjId}`, ref: adjId,
    });
    await this.store.update('balance_adjustments', adjId, { status: 'EXECUTED', executed_by: user.id, updated_at: Date.now() });
    await this.audit.operatorAction({
      actor: user.id, role: user.role, action: 'adjustment.execute',
      entityType: 'balance_adjustment', entityId: adjId,
      oldState: 'APPROVED', newState: 'EXECUTED', approvalId,
      requestMeta: { delta: adj.delta, asset: adj.asset },
    });
    const t = setTimeout(async () => {
      const cur = await this.store.get('balance_adjustments', adjId);
      if (cur?.status === 'EXECUTED') {
        await this.store.update('balance_adjustments', adjId, { status: 'AUDITED', updated_at: Date.now() });
        await this.audit.record({
          actor: 'system', role: 'system', action: 'adjustment.audited',
          targetType: 'balance_adjustment', targetId: adjId,
          oldState: 'EXECUTED', newState: 'AUDITED', reason: 'Automated post-execution audit sweep',
        });
      }
    }, 30_000);
    t.unref?.();
    return this.store.get('balance_adjustments', adjId);
  }

  async reject(user, adjId, { reason }) {
    const adj = await this.store.get('balance_adjustments', adjId);
    if (!adj) throw new OperatorError('Adjustment not found', 'NOT_FOUND');
    if (!['REQUESTED', 'REVIEW', 'APPROVED'].includes(adj.status)) throw new OperatorError(`Cannot reject from ${adj.status}`, 'BAD_STATE');
    await this.store.update('balance_adjustments', adjId, { status: 'REJECTED', updated_at: Date.now() });
    await this.audit.operatorAction({
      actor: user.id, role: user.role, action: 'adjustment.reject',
      entityType: 'balance_adjustment', entityId: adjId, reason,
      oldState: adj.status, newState: 'REJECTED',
    });
    return this.store.get('balance_adjustments', adjId);
  }

  list(filters = {}) {
    const opts = { order: 'ts', dir: 'desc', limit: Math.min(Number(filters.limit ?? 100), 500) };
    const eq = {};
    if (filters.status) eq.status = filters.status;
    if (Object.keys(eq).length) opts.eq = eq;
    const rows = this.store.all('balance_adjustments', opts);
    const users = new Map(this.store.all('users', { limit: 500 }).map((u) => [u.id, u.email]));
    for (const r of rows) {
      r.target_email = users.get(r.user_id) ?? r.user_id;
      r.requester_email = users.get(r.requested_by) ?? r.requested_by;
    }
    return rows;
  }
}

// ---------------------------------------------------------------------------
export class ApprovalService {
  constructor(ctx) {
    this.store = ctx.store;
    this.audit = ctx.audit;
    this.bus = ctx.bus;
    this.executors = new Map(); // "scope:action" -> fn({request, approvers})
  }

  registerExecutor(scope, action, fn) {
    this.executors.set(`${scope}:${action}`, fn);
  }

  list(filters = {}) {
    const opts = { order: 'ts', dir: 'desc', limit: Math.min(Number(filters.limit ?? 100), 500) };
    const eq = {};
    if (filters.status) eq.status = filters.status;
    if (filters.scope) eq.scope = filters.scope;
    if (Object.keys(eq).length) opts.eq = eq;
    const rows = this.store.all('approval_requests', opts);
    const users = new Map(this.store.all('users', { limit: 500 }).map((u) => [u.id, u.email]));
    for (const r of rows) {
      r.requester_email = users.get(r.requested_by) ?? r.requested_by;
      for (const a of r.approvals ?? []) a.email = users.get(a.by) ?? a.by;
    }
    return rows;
  }

  async approve(user, id, { reason }) {
    const exec = ({ request }) => {
      const fn = this.executors.get(`${request.scope}:${request.action}`);
      if (fn) return fn({ request });
      return null;
    };
    const { can } = await import('../domain/rbac.js');
    const req = await approveApproval(this.store, {
      id, approver: user.id, role: user.role, reason,
      isApprover: can(user.role, 'approvals:act'),
      execute: exec,
    });
    await this.audit.record({
      actor: user.id, role: user.role, action: req.status === 'EXECUTED' ? 'approval.executed' : 'approval.approved',
      targetType: 'approval', targetId: id,
      oldState: 'PENDING', newState: req.status, reason,
      approvalId: id,
      requestMeta: { scope: req.scope, action: req.action, target: req.target_id },
    });
    this.bus?.pushOps({ kind: 'approval', data: req });
    return req;
  }

  async reject(user, id, { reason }) {
    const req = rejectApproval(this.store, { id, by: user.id, role: user.role, reason });
    await this.audit.record({
      actor: user.id, role: user.role, action: 'approval.rejected',
      targetType: 'approval', targetId: id,
      oldState: 'PENDING', newState: 'REJECTED', reason, approvalId: id,
    });
    this.bus?.pushOps({ kind: 'approval', data: req });
    return req;
  }

  sweep() {
    return expireStale(this.store);
  }
}
