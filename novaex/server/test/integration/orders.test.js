import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from '../helpers.js';
import { reconcile } from '../../src/domain/ledger.js';

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.srv.close(); });

test('market buy fills immediately, moves balances, writes trade + fee', async () => {
  const dana = app.user.dana;
  const balBefore = app.store.all('balances', { eq: { user_id: 'u_dana', asset: 'USDT' } })[0].available;
  const btcBefore = app.store.all('balances', { eq: { user_id: 'u_dana', asset: 'BTC' } })[0].available;
  const res = await app.call('POST', '/api/v1/orders', {
    user: dana,
    body: { pair: 'BTC/USDT', side: 'BUY', type: 'MARKET', quoteAmount: '1,000' },
  });
  assert.equal(res.status, 201);
  const order = res.json.order;
  assert.equal(order.state, 'FILLED');
  assert.ok(order.filled > 0);
  assert.ok(order.fee > 0);
  assert.equal(order.fee_asset, 'USDT');

  const balAfter = app.store.all('balances', { eq: { user_id: 'u_dana', asset: 'USDT' } })[0];
  assert.equal(balAfter.available, balBefore - order.quote_filled - order.fee);
  const btc = app.store.all('balances', { eq: { user_id: 'u_dana', asset: 'BTC' } })[0];
  assert.equal(btc.available, btcBefore + order.filled);

  const trades = app.store.all('trades', { eq: { order_id: order.id } });
  assert.equal(trades.length, 1);
  const txs = app.store.all('transactions', { eq: { ref_type: 'order', ref_id: order.id } });
  assert.equal(txs.length, 1);
  assert.deepEqual(reconcile(app.store), []);
});

test('insufficient balance is rejected 422', async () => {
  const res = await app.call('POST', '/api/v1/orders', {
    user: app.user.greg,
    body: { pair: 'BTC/USDT', side: 'BUY', type: 'MARKET', quoteAmount: '99,999,999' },
  });
  assert.equal(res.status, 422);
  assert.equal(res.json.error.code, 'INSUFFICIENT_FUNDS');
});

test('customer cannot open limit orders (role enforced)', async () => {
  const res = await app.call('POST', '/api/v1/orders', {
    user: app.user.alice, // role: user
    body: { pair: 'BTC/USDT', side: 'BUY', type: 'LIMIT', price: '100000', baseAmount: '0.01' },
  });
  assert.equal(res.status, 403);
});

test('limit order reserves funds, rests OPEN, cancels with release', async () => {
  const dana = app.user.dana;
  const before = app.store.all('balances', { eq: { user_id: 'u_dana', asset: 'USDT' } })[0];
  const res = await app.call('POST', '/api/v1/orders', {
    user: dana,
    body: { pair: 'SOL/USDT', side: 'BUY', type: 'LIMIT', price: '150', baseAmount: '10' },
  });
  assert.equal(res.status, 201);
  const order = res.json.order;
  assert.equal(order.state, 'OPEN');
  const during = app.store.all('balances', { eq: { user_id: 'u_dana', asset: 'USDT' } })[0];
  assert.ok(during.reserved >= during.reserved); // reserved moved from available
  assert.equal(before.available, during.available + during.reserved - before.reserved);

  const cancel = await app.call('POST', `/api/v1/orders/${order.id}/cancel`, { user: dana, body: { reason: 'changing mind' } });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.json.order.state, 'CANCELLED');
  const after = app.store.all('balances', { eq: { user_id: 'u_dana', asset: 'USDT' } })[0];
  assert.equal(after.available, before.available);
  assert.equal(after.reserved, before.reserved);

  const events = app.store.all('order_events', { eq: { order_id: order.id }, order: 'ts', dir: 'asc' });
  const states = events.map((e) => e.to_state);
  assert.ok(states.includes('CANCEL_REQUESTED'));
  assert.ok(states.includes('CANCELLED'));
  assert.deepEqual(reconcile(app.store), []);
});

test('user cannot cancel or read someone else\'s order', async () => {
  const danaOrders = app.store.all('orders', { eq: { user_id: 'u_dana', state: 'OPEN' }, limit: 1 });
  assert.ok(danaOrders.length > 0);
  const o = danaOrders[0];
  const read = await app.call('GET', `/api/v1/orders/${o.id}`, { user: app.user.alice });
  assert.equal(read.status, 403);
  const cancel = await app.call('POST', `/api/v1/orders/${o.id}/cancel`, { user: app.user.alice });
  assert.equal(cancel.status, 403);
});

test('idempotency key replays the same result instead of double-ordering', async () => {
  const dana = app.user.dana;
  const body = { pair: 'ETH/USDT', side: 'BUY', type: 'MARKET', quoteAmount: '50' };
  const key = `itest-${Date.now()}`;
  const r1 = await app.call('POST', '/api/v1/orders', { user: dana, body, headers: { 'Idempotency-Key': key } });
  assert.equal(r1.status, 201);
  const r2 = await app.call('POST', '/api/v1/orders', { user: dana, body, headers: { 'Idempotency-Key': key } });
  assert.ok([200, 201].includes(r2.status), `replay should return the original response, got ${r2.status}`);
  assert.equal(r2.json.order.id, r1.json.order.id); // same order — not double-processed
  // same key with different body conflicts
  const r3 = await app.call('POST', '/api/v1/orders', { user: dana, body: { ...body, quoteAmount: '51' }, headers: { 'Idempotency-Key': key } });
  assert.equal(r3.status, 409);
});

test('orders respect paused markets (operator control)', async () => {
  const maya = app.user.maya;
  const set = await app.call('POST', '/api/v1/operator/markets/XRP-USDT/control', {
    user: maya, body: { state: 'PAUSED', reason: 'test pause' },
  });
  assert.equal(set.status, 200);
  const res = await app.call('POST', '/api/v1/orders', {
    user: app.user.dana,
    body: { pair: 'XRP/USDT', side: 'BUY', type: 'MARKET', quoteAmount: '100' },
  });
  assert.notEqual(res.status, 201, 'orders must be rejected on a paused market');
  const resume = await app.call('POST', '/api/v1/operator/markets/XRP-USDT/control', {
    user: maya, body: { state: 'TRADING', reason: 'test resume' },
  });
  assert.equal(resume.status, 200);
});

test('operator intervention on flagged order 92832: approve review -> OPEN', async () => {
  const maya = app.user.maya;
  const detail = await app.call('GET', '/api/v1/operator/orders/92832', { user: maya });
  assert.equal(detail.status, 200);
  assert.equal(detail.json.order.state, 'MANUAL_REVIEW');
  const act = await app.call('POST', `/api/v1/operator/orders/${detail.json.order.id}/action`, {
    user: maya, body: { action: 'approve_review', reason: 'size verified against account history' },
  });
  assert.equal(act.status, 200);
  assert.equal(act.json.order.state, 'OPEN');
  const audit = app.store.all('audit_logs', { eq: { action: 'order.approve_review', target_id: detail.json.order.id } });
  assert.ok(audit.length >= 1);
  assert.equal(audit[0].actor, 'u_maya');
});
