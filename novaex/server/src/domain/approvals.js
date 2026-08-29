// Two-person approval workflow engine (deterministic, auditable).
// One operator requests; a SECOND authorized operator approves.
// Self-approval is always rejected. Both identities are recorded.

export class ApprovalError extends Error {
  constructor(msg, code) {
    super(msg);
    this.name = 'ApprovalError';
    this.code = code ?? 'APPROVAL_ERROR';
    const MAP = { FORBIDDEN: 403, SELF_APPROVAL: 403, NOT_FOUND: 404, EXPIRED: 409, BAD_STATUS: 400 };
    this.status = MAP[code] ?? 400;
  }
}

export const APPROVAL_PENDING = 'PENDING';

export function requiredApprovalsFor(scope, { amountUsdt = 0, policy = {} } = {}) {
  switch (scope) {
    case 'withdrawal':
      return amountUsdt >= (policy.withdrawalMinUsdt ?? 50_000) ? 2 : 1;
    case 'balance_adjustment':
      return amountUsdt >= (policy.adjustmentHighRiskUsdt ?? 5_000) ? 2 : 1;
    case 'market_control':
    case 'emergency_control':
    case 'fee_change':
      return policy.marketControl ? 2 : 1;
    case 'order_intervention':
      return 1;
    default:
      return 1;
  }
}

/** Create a pending approval request.
 *  Two-person rule: for required=2, the requester's explicit authorization
 *  counts as approval #1; a SECOND distinct authorized person must approve. */
export function createApproval(store, {
  scope, action, targetType, targetId, requestedBy, role, reason, meta = {}, required, ttlMs = 24 * 3600e3, initialApprover = null,
}) {
  if (!requestedBy) throw new ApprovalError('Requester identity required', 'NO_REQUESTER');
  const initial = initialApprover
    ? [{ by: initialApprover, role: role ?? 'operator', reason: 'Request authorization', ts: Date.now() }]
    : [];
  const req = store.insert('approval_requests', {
    id: `APP-${String(store.nextSeq('approval')).padStart(5, '0')}`,
    scope,
    action,
    target_type: targetType,
    target_id: targetId,
    requested_by: requestedBy,
    requested_role: role,
    reason,
    meta,
    required_approvals: required,
    approvals: initial,
    rejections: [],
    status: 'PENDING',
    executed_by: null,
    execution_result: null,
    ts: Date.now(),
    expires_at: Date.now() + ttlMs,
  });
  return req;
}

/** Approve by an authorized second person. Returns the (possibly executed) request. */
export async function approveApproval(store, { id, approver, role, reason, isApprover, execute }) {
  const req = store.get('approval_requests', id);
  if (!req) throw new ApprovalError('Approval request not found', 'NOT_FOUND');
  if (req.status !== 'PENDING') throw new ApprovalError(`Request is ${req.status}, not PENDING`, 'BAD_STATUS');
  if (!isApprover) throw new ApprovalError('Approver lacks approval authority', 'FORBIDDEN');
  if (approver === req.requested_by) throw new ApprovalError('Requester cannot approve their own request', 'SELF_APPROVAL');

  const ts = Date.now();
  const approvals = [...req.approvals.filter((a) => a.by !== approver), { by: approver, role, reason: reason ?? null, ts }];
  store.update('approval_requests', id, { approvals });

  if (approvals.length >= req.required_approvals) {
    let result = null;
    if (execute) {
      let r = execute({ request: req, approvers: approvals });
      if (r && typeof r.then === 'function') r = await r;
      result = r;
    }
    store.update('approval_requests', id, { status: 'EXECUTED', executed_by: approver, execution_result: result, ts });
    return store.get('approval_requests', id);
  }
  store.update('approval_requests', id, { ts });
  return store.get('approval_requests', id);
}

export function rejectApproval(store, { id, by, role, reason }) {
  const req = store.get('approval_requests', id);
  if (!req) throw new ApprovalError('Approval request not found', 'NOT_FOUND');
  if (req.status !== 'PENDING') throw new ApprovalError(`Request is ${req.status}, not PENDING`, 'BAD_STATUS');
  if (by === req.requested_by) throw new ApprovalError('Requester cannot reject their own request', 'SELF_APPROVAL');
  const rejections = [...req.rejections, { by, role, reason: reason ?? null, ts: Date.now() }];
  store.update('approval_requests', id, { status: 'REJECTED', rejections, ts: Date.now() });
  return store.get('approval_requests', id);
}

/** Expire stale pending requests (called by a sweep). */
export function expireStale(store, now = Date.now()) {
  const pending = store.all('approval_requests', { eq: { status: 'PENDING' }, limit: 10_000 });
  let n = 0;
  for (const r of pending) {
    if (r.expires_at && r.expires_at < now) {
      store.update('approval_requests', r.id, { status: 'EXPIRED', ts: now });
      n++;
    }
  }
  return n;
}
