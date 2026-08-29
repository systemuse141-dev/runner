import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../../src/store/filestore.js';
import {
  createApproval, approveApproval, rejectApproval, expireStale, ApprovalError,
} from '../../src/domain/approvals.js';

const mk = () => createMemoryStore();
const base = { scope: 'market_control', action: 'market_paused', targetType: 'market', targetId: 'BTC/USDT', reason: 'test' };

test('requester cannot approve their own request', async () => {
  const store = mk();
  const req = createApproval(store, { ...base, requestedBy: 'op1', role: 'operator', required: 2, initialApprover: 'op1' });
  await assert.rejects(
    () => approveApproval(store, { id: req.id, approver: 'op1', role: 'operator', isApprover: true }),
    (e) => e.code === 'SELF_APPROVAL'
  );
});

test('two-person rule: second distinct operator completes dual approval', async () => {
  const store = mk();
  let executed = null;
  const req = createApproval(store, { ...base, requestedBy: 'op1', role: 'operator', required: 2, initialApprover: 'op1' });
  const afterFirst = await approveApproval(store, { id: req.id, approver: 'op2', role: 'admin', reason: 'ok', isApprover: true, execute: () => { executed = true; } });
  assert.equal(afterFirst.status, 'EXECUTED');
  assert.equal(executed, true);
  assert.equal(afterFirst.executed_by, 'op2');
  assert.equal(afterFirst.approvals.length, 2);
});

test('non-approver role is blocked', async () => {
  const store = mk();
  const req = createApproval(store, { ...base, requestedBy: 'op1', role: 'operator', required: 2, initialApprover: 'op1' });
  await assert.rejects(
    () => approveApproval(store, { id: req.id, approver: 'user9', role: 'user', isApprover: false }),
    (e) => e.code === 'FORBIDDEN'
  );
});

test('single-approval scope executes immediately', async () => {
  const store = mk();
  const req = createApproval(store, { ...base, requestedBy: 'op1', role: 'operator', required: 1 });
  const out = await approveApproval(store, { id: req.id, approver: 'op2', role: 'operator', isApprover: true });
  assert.equal(out.status, 'EXECUTED');
});

test('rejection is terminal and recorded', async () => {
  const store = mk();
  const req = createApproval(store, { ...base, requestedBy: 'op1', role: 'operator', required: 2, initialApprover: 'op1' });
  const out = await rejectApproval(store, { id: req.id, by: 'op2', role: 'admin', reason: 'no' });
  assert.equal(out.status, 'REJECTED');
  assert.equal(out.rejections[0].by, 'op2');
  await assert.rejects(
    () => approveApproval(store, { id: req.id, approver: 'op3', role: 'admin', isApprover: true }),
    (e) => e.code === 'BAD_STATUS'
  );
});

test('double approve by same second person does not count twice', async () => {
  const store = mk();
  const req = createApproval(store, { ...base, requestedBy: 'op1', role: 'operator', required: 3, initialApprover: 'op1' });
  const a = await approveApproval(store, { id: req.id, approver: 'op2', role: 'admin', isApprover: true });
  assert.equal(a.status, 'PENDING');
  const b = await approveApproval(store, { id: req.id, approver: 'op2', role: 'admin', isApprover: true });
  assert.equal(b.approvals.length, 2); // op1 (initial) + op2 — re-approval does not add a third
  assert.deepEqual(b.approvals.map((x) => x.by), ['op1', 'op2']);
  assert.equal(b.status, 'PENDING'); // 2 < required 3
});

test('stale pending requests expire', async () => {
  const store = mk();
  const req = createApproval(store, { ...base, requestedBy: 'op1', role: 'operator', required: 2, initialApprover: 'op1', ttlMs: 1 });
  await new Promise((r) => setTimeout(r, 10));
  const n = expireStale(store);
  assert.equal(n, 1);
  assert.equal(store.get('approval_requests', req.id).status, 'EXPIRED');
});

test('async executors are awaited before marking executed', async () => {
  const store = mk();
  const req = createApproval(store, { ...base, requestedBy: 'op1', role: 'operator', required: 2, initialApprover: 'op1' });
  let flag = false;
  const out = await approveApproval(store, {
    id: req.id, approver: 'op2', role: 'admin', isApprover: true,
    execute: async () => { await new Promise((r) => setTimeout(r, 5)); flag = true; return { ran: true }; },
  });
  assert.equal(flag, true);
  assert.deepEqual(out.execution_result, { ran: true });
});
