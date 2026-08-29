import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from '../helpers.js';
import { reconcile } from '../../src/domain/ledger.js';

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.srv.close(); });

test('high-value withdrawal: dual approval by two different operators', async () => {
  // seeded: dana's 60k USDT withdrawal is IN_REVIEW with 1/2 approvals (u_ops)
  const list = await app.call('GET', '/api/v1/operator/withdrawals', { user: app.user.maya });
  assert.equal(list.status, 200);
  const wd = list.json.withdrawals.find((w) => w.amount === 6_000_000 && w.status === 'IN_REVIEW');
  assert.ok(wd, 'seeded high-value withdrawal should be pending');
  assert.equal(wd.required_approvals, 2);
  assert.equal(wd.approvals.length, 1);
  assert.equal(wd.approvals[0].by, 'u_ops');

  // dana's withdrawal: maya (second operator) completes it
  const two = await app.call('POST', `/api/v1/operator/withdrawals/${wd.id}/action`, {
    user: app.user.maya, body: { action: 'approve', reason: 'identity verified, source of funds documented' },
  });
  assert.equal(two.status, 200);
  assert.equal(two.json.withdrawal.status, 'APPROVED');
  assert.equal(two.json.withdrawal.approvals.length, 2);
  const ops = two.json.withdrawal.approvals.map((a) => a.by);
  assert.ok(ops.includes('u_ops') && ops.includes('u_maya'));
  assert.deepEqual(reconcile(app.store), []);
});

test('operator re-approval does not count as a second distinct person', async () => {
  // fund dana so a >50k dual-control withdrawal is possible
  const dep = await app.call('POST', '/api/v1/wallets/deposit', {
    user: app.user.dana,
    body: { asset: 'USDT', network: 'erc20', amount: '100,000', address: '0x' + '77'.repeat(20) + 'funded' },
  });
  assert.equal(dep.status, 201);
  await app.sleep(3400);
  // create a fresh high-value withdrawal as dana
  const res = await app.call('POST', '/api/v1/wallets/withdraw', {
    user: app.user.dana,
    body: { asset: 'USDT', network: 'erc20', address: '0x' + '99'.repeat(20) + 'selftest', amount: '55,000' },
  });
  assert.equal(res.status, 201, JSON.stringify(res.json));
  const wd = res.json.withdrawal;
  assert.equal(wd.required_approvals, 2);
  // no approvals yet — first try ops
  const a1 = await app.call('POST', `/api/v1/operator/withdrawals/${wd.id}/action`, { user: app.user.ops, body: { action: 'approve', reason: 'first' } });
  assert.equal(a1.json.withdrawal.status, 'IN_REVIEW');
  // ops trying to approve AGAIN is ignored as a distinct second approval (deduped)
  const a2 = await app.call('POST', `/api/v1/operator/withdrawals/${wd.id}/action`, { user: app.user.ops, body: { action: 'approve', reason: 'again' } });
  assert.equal(a2.json.withdrawal.approvals.length, 1);
  assert.equal(a2.json.withdrawal.status, 'IN_REVIEW');
});

test('balance adjustment lifecycle: request -> dual approve -> executed -> ledger', async () => {
  const ops = app.user.ops;
  const maya = app.user.maya;
  const gregBefore = app.store.all('balances', { eq: { user_id: 'u_greg', asset: 'USDT' } })[0].available;

  const create = await app.call('POST', '/api/v1/operator/adjustments', {
    user: ops,
    body: {
      targetUserId: 'u_greg', asset: 'USDT', amount: '7,500',
      reason: 'Test goodwill credit for outage compensation',
      reference: 'INC-TEST', evidence: { ticket: '#1' },
    },
  });
  assert.equal(create.status, 201);
  const adj = create.json.adjustment;
  assert.equal(adj.required_approvals, 2);
  assert.ok(['REQUESTED', 'REVIEW', 'APPROVED', 'EXECUTED'].includes(adj.status));

  if (adj.status !== 'EXECUTED') {
    const ap = await app.call('POST', `/api/v1/operator/adjustments/${adj.id}/approve`, { user: maya, body: { reason: 'verified' } });
    assert.equal(ap.status, 200);
    // ops is requester: if only 1 approval recorded before maya, maya completes it
  }
  const final = app.store.get('balance_adjustments', adj.id);
  assert.equal(final.status, 'EXECUTED');
  const gregAfter = app.store.all('balances', { eq: { user_id: 'u_greg', asset: 'USDT' } })[0].available;
  assert.equal(gregAfter, gregBefore + 750_000);
  assert.deepEqual(reconcile(app.store), []);
  const audits = app.store.all('audit_logs', { eq: { action: 'adjustment.execute', target_id: adj.id } });
  assert.ok(audits.length >= 1);
});

test('requester cannot approve their own adjustment', async () => {
  const ops = app.user.ops;
  const create = await app.call('POST', '/api/v1/operator/adjustments', {
    user: ops,
    body: { targetUserId: 'u_alice', asset: 'USDT', amount: '8,000', reason: 'Self-test adjustment that must not self-approve' },
  });
  const adj = create.json.adjustment;
  // the requester's own approval is always blocked — even before anyone else acts
  const self = await app.call('POST', `/api/v1/operator/adjustments/${adj.id}/approve`, { user: ops, body: { reason: 'self' } });
  assert.equal(self.status, 403);
  assert.equal(self.json.error.code, 'SELF_APPROVAL');
  // a distinct second approver completes the two-person rule -> executed
  const ok = await app.call('POST', `/api/v1/operator/adjustments/${adj.id}/approve`, { user: app.user.maya, body: { reason: 'verified evidence' } });
  assert.equal(ok.json.adjustment.status, 'EXECUTED', JSON.stringify(ok.json));
});

test('emergency control: pause trading requires dual approval and executes', async () => {
  const ops = app.user.ops;
  const req = await app.call('POST', '/api/v1/operator/system/request-control', {
    user: ops, body: { key: 'trading', value: 'PAUSED', reason: 'Drill: incident response test' },
  });
  assert.equal(req.status, 200);
  const approval = req.json.approval;
  assert.equal(approval.required_approvals, 2);
  assert.equal(approval.approvals.length, 1); // ops' own request authorization

  const trading = await app.call('GET', '/api/v1/operator/system', { user: ops });
  assert.equal(trading.json.controls.values.trading, 'LIVE'); // not yet executed

  const done = await app.call('POST', `/api/v1/approvals/${approval.id}/approve`, {
    user: app.user.maya, body: { reason: 'authorized: drill' },
  });
  assert.equal(done.json.approval.status, 'EXECUTED');

  const after = await app.call('GET', '/api/v1/operator/system', { user: ops });
  assert.equal(after.json.controls.values.trading, 'PAUSED');

  // orders are now rejected globally
  const order = await app.call('POST', '/api/v1/orders', {
    user: app.user.dana,
    body: { pair: 'BTC/USDT', side: 'BUY', type: 'MARKET', quoteAmount: '100' },
  });
  assert.notEqual(order.status, 201);

  // controlled recovery
  const resume = await app.call('POST', '/api/v1/operator/system/request-control', {
    user: app.user.ops, body: { key: 'trading', value: 'LIVE', reason: 'Drill complete' },
  });
  const r2 = await app.call('POST', `/api/v1/approvals/${resume.json.approval.id}/approve`, {
    user: app.user.maya, body: { reason: 'resume authorized' },
  });
  assert.equal(r2.json.approval.status, 'EXECUTED');
  const back = await app.call('GET', '/api/v1/operator/system', { user: ops });
  assert.equal(back.json.controls.values.trading, 'LIVE');
});

test('single-operator control (pause buy) executes immediately with audit', async () => {
  const ops = app.user.ops;
  const res = await app.call('POST', '/api/v1/operator/system/control', {
    user: ops, body: { key: 'buy', value: 'PAUSED', reason: 'Liquidity check' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.controls.values.buy, 'PAUSED');
  const buyOrder = await app.call('POST', '/api/v1/orders', {
    user: app.user.dana,
    body: { pair: 'ETH/USDT', side: 'BUY', type: 'MARKET', quoteAmount: '100' },
  });
  assert.notEqual(buyOrder.status, 201);
  const sellOrder = await app.call('POST', '/api/v1/orders', {
    user: app.user.dana,
    body: { pair: 'ETH/USDT', side: 'SELL', type: 'MARKET', baseAmount: '0.01' },
  });
  assert.equal(sellOrder.status, 201); // sells still fine
  const audits = app.store.all('audit_logs', { eq: { action: 'system.buy_paused' } });
  assert.ok(audits.length >= 1);
  // restore
  await app.call('POST', '/api/v1/operator/system/control', {
    user: app.user.ops, body: { key: 'buy', value: 'LIVE', reason: 'Check complete' },
  });
});
