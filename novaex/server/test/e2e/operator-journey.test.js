// E2E: operator day-in-the-life — attention queue, reviews, risk,
// dual controls, AI proposals.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from '../helpers.js';
import { reconcile } from '../../src/domain/ledger.js';

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.srv.close(); });

test('overview: health, live ops, attention queue', async () => {
  const ov = await app.call('GET', '/api/v1/operator/overview', { user: app.user.ops });
  assert.equal(ov.status, 200);
  assert.equal(ov.json.health.length, 8);
  assert.ok(ov.json.health.every((h) => h.status && h.latency > 0));
  assert.ok(ov.json.live.manualReviews >= 3);
  assert.ok(ov.json.live.pendingWithdrawals >= 2);
  assert.ok(ov.json.attentionQueue.length >= 3);
  assert.ok(ov.json.attentionQueue.every((q) => q.url));
});

test('attention queue item links to the entity detail', async () => {
  const ov = await app.call('GET', '/api/v1/operator/overview', { user: app.user.ops });
  const item = ov.json.attentionQueue.find((q) => q.kind === 'manual_review' && q.kindLabel === 'order');
  assert.ok(item, 'order review should be in the queue');
  const num = item.id; // entity id is the order id; fetch by num via operator orders
  const orders = await app.call('GET', `/api/v1/operator/orders`, { user: app.user.ops });
  const order = orders.json.orders.find((o) => o.id === num);
  assert.ok(order, 'queued order must be resolvable');
  assert.equal(order.state, 'MANUAL_REVIEW');
});

test('manual review of order 92832: risk detail + operator approve -> OPEN', async () => {
  const detail = await app.call('GET', '/api/v1/operator/orders/92832', { user: app.user.ops });
  assert.equal(detail.status, 200);
  assert.equal(detail.json.order.state, 'MANUAL_REVIEW');
  assert.equal(detail.json.riskEvents.length, 1);
  assert.equal(detail.json.riskEvents[0].level, 'HIGH');
  assert.ok(detail.json.events.length >= 3);
  assert.ok(detail.json.user.email === 'dana@novaex.demo');

  const approve = await app.call('POST', `/api/v1/operator/orders/${detail.json.order.id}/action`, {
    user: app.user.ops, body: { action: 'approve_review', reason: 'Verified against 30d activity; within risk appetite' },
  });
  assert.equal(approve.status, 200);
  assert.equal(approve.json.order.state, 'OPEN');
  // manual review resolved
  const reviews = app.store.all('manual_reviews', { eq: { kind: 'order', entity_id: detail.json.order.id } });
  assert.ok(reviews.every((r) => r.status === 'RESOLVED'));
});

test('withdrawal review center: approve alice MEDIUM withdrawal', async () => {
  const list = await app.call('GET', '/api/v1/operator/withdrawals?status=IN_REVIEW', { user: app.user.ops });
  assert.equal(list.status, 200);
  const aliceWd = list.json.withdrawals.find((w) => w.user_id === 'u_alice' && w.risk_level === 'MEDIUM');
  assert.ok(aliceWd);
  const detail = await app.call('GET', `/api/v1/operator/withdrawals/${aliceWd.id}`, { user: app.user.ops });
  assert.equal(detail.status, 200);
  assert.equal(detail.json.riskEvent.level, 'MEDIUM');
  const approve = await app.call('POST', `/api/v1/operator/withdrawals/${aliceWd.id}/action`, {
    user: app.user.ops, body: { action: 'approve', reason: 'Address matches on-file destination' },
  });
  assert.equal(approve.json.withdrawal.status, 'APPROVED');
});

test('risk center: list, resolve, and rule reference', async () => {
  const rules = await app.call('GET', '/api/v1/operator/risk/rules', { user: app.user.ops });
  assert.ok(rules.json.rules.length >= 6);
  const events = await app.call('GET', '/api/v1/operator/risk/events?status=OPEN', { user: app.user.ops });
  assert.equal(events.status, 200);
  assert.ok(events.json.events.length >= 1);
  const one = events.json.events[0];
  const resolved = await app.call('POST', `/api/v1/operator/risk/events/${one.id}/resolve`, {
    user: app.user.ops, body: { note: 'Investigated — within tolerance' },
  });
  assert.equal(resolved.json.event.status, 'RESOLVED');
  assert.equal(resolved.json.event.resolved_by, 'u_ops');
});

test('dual control: pause a market via approval workflow', async () => {
  const req = await app.call('POST', '/api/v1/operator/markets/DOGE-USDT/request-control', {
    user: app.user.ops, body: { state: 'PAUSED', reason: 'Volatility incident' },
  });
  assert.equal(req.status, 200);
  const approval = req.json.approval;
  assert.equal(approval.required_approvals, 2);
  const approve = await app.call('POST', `/api/v1/approvals/${approval.id}/approve`, {
    user: app.user.maya, body: { reason: 'Confirmed with desk' },
  });
  assert.equal(approve.json.approval.status, 'EXECUTED');
  const markets = await app.call('GET', '/api/v1/operator/markets', { user: app.user.ops });
  const doge = markets.json.markets.find((m) => m.pair === 'DOGE/USDT');
  assert.equal(doge.control.state, 'PAUSED');
  // trading on the paused market is rejected
  const order = await app.call('POST', '/api/v1/orders', {
    user: app.user.dana, body: { pair: 'DOGE/USDT', side: 'BUY', type: 'MARKET', quoteAmount: '50' },
  });
  assert.notEqual(order.status, 201);
});

test('operator timeline for a user aggregates all event kinds', async () => {
  const tl = await app.call('GET', '/api/v1/operator/timeline?entity=user&id=u_dana', { user: app.user.ops });
  assert.equal(tl.status, 200);
  const kinds = new Set(tl.json.timeline.map((t) => t.kind));
  assert.ok(kinds.has('TRADE'));
  assert.ok(kinds.has('ORDER'));
  assert.ok(kinds.has('WITHDRAWAL'));
  assert.ok(tl.json.timeline.length >= 10);
});

test('AI assistant answers operational questions from stored data', async () => {
  const chat = (message, context = {}) => app.call('POST', '/api/v1/ai/chat', { user: app.user.ops, body: { message, context } });
  const reviews = await chat("Show me today's manual reviews");
  assert.equal(reviews.status, 200);
  assert.ok(/manual review/i.test(reviews.json.text));
  const withdrawals = await chat('What withdrawals require attention?');
  assert.ok(/withdrawal/i.test(withdrawals.json.text));
  const paused = await chat('Which markets are paused?');
  assert.ok(/DOGE\/USDT|TRADING|paused/i.test(paused.json.text));
  const alerts = await chat('Show unresolved critical alerts');
  assert.ok(/CRITICAL|critical/i.test(alerts.json.text));
  const summary = await chat('Summarize the last hour');
  assert.ok(/snapshot|last 1 hour/i.test(summary.json.text));
  const explain = await chat('Why is order 92832 flagged?');
  assert.ok(/R6_ORDER_ANOMALY|Order size anomaly/.test(explain.json.text));
});

test('AI action proposal requires explicit authorization', async () => {
  const reply = await app.call('POST', '/api/v1/ai/chat', {
    user: app.user.ops, body: { message: 'Pause the LINK market' },
  });
  const prop = reply.json.blocks.find((b) => b.kind === 'proposal');
  assert.ok(prop, 'AI must respond with a proposal, not execute');
  assert.equal(prop.data.status, 'PENDING');
  assert.equal(prop.data.kind, 'PAUSE_MARKET');

  // customer cannot authorize
  const cust = await app.call('POST', `/api/v1/ai/proposals/${prop.data.id}/authorize`, { user: app.user.alice });
  assert.equal(cust.status, 403);

  // operator authorizes -> routed to dual approval (not executed silently)
  const auth = await app.call('POST', `/api/v1/ai/proposals/${prop.data.id}/authorize`, { user: app.user.ops });
  assert.equal(auth.json.dual, true);
  assert.equal(auth.json.approval.status, 'PENDING');

  // market still trading until second approval
  const markets = await app.call('GET', '/api/v1/operator/markets', { user: app.user.ops });
  assert.equal(markets.json.markets.find((m) => m.pair === 'LINK/USDT').control.state, 'TRADING');

  const second = await app.call('POST', `/api/v1/approvals/${auth.json.approval.id}/approve`, {
    user: app.user.maya, body: { reason: 'Confirmed' },
  });
  assert.equal(second.json.approval.status, 'EXECUTED');
  const after = await app.call('GET', '/api/v1/operator/markets', { user: app.user.ops });
  assert.equal(after.json.markets.find((m) => m.pair === 'LINK/USDT').control.state, 'PAUSED');

  // proposal can also be cancelled instead
  const reply2 = await app.call('POST', '/api/v1/ai/chat', { user: app.user.ops, body: { message: 'Pause the ADA market' } });
  const prop2 = reply2.json.blocks.find((b) => b.kind === 'proposal');
  const cancel = await app.call('POST', `/api/v1/ai/proposals/${prop2.data.id}/cancel`, { user: app.user.ops });
  assert.equal(cancel.json.proposal.status, 'CANCELLED');
});

test('ledger stays consistent through the operator journey', () => {
  assert.deepEqual(reconcile(app.store), []);
});
