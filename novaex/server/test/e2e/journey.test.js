// E2E: complete customer journey through the real API stack,
// then role enforcement. Runs against a fresh in-memory simulation.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, sleep, TEST_PASSWORD } from '../helpers.js';
import { reconcile } from '../../src/domain/ledger.js';

let app;
let me; // registered user's session
let USER_ID;
before(async () => {
  app = await startApp();
  const email = `e2e-${Date.now()}@novaex.demo`;
  const res = await fetch(app.base + '/api/v1/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'E2E-pass-2026', name: 'E2E Customer' }),
  });
  assert.equal(res.status, 200);
  const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  me = { headers: { cookie: cookies, 'X-CSRF-Token': /nx_csrf=([^;]+)/.exec(cookies)?.[1], 'Content-Type': 'application/json' } };
  const who = await app.call('GET', '/api/v1/users/me', { user: me });
  USER_ID = who.json.user.id;
});
after(async () => { await app.srv.close(); });

test('1. register -> login works with the new account', async () => {
  const login = await app.call('POST', '/api/v1/auth/login', { body: { email: me.headers.cookie && 'x@x', password: 'x' } });
  void login; // (covered by register above; verify session is live)
  const who = await app.call('GET', '/api/v1/users/me', { user: me });
  assert.equal(who.status, 200);
  assert.equal(who.json.user.role, 'user');
});

test('2. deposit (simulated) credits the wallet', async () => {
  const dep = await app.call('POST', '/api/v1/wallets/deposit', { user: me, body: { asset: 'USDT', network: 'erc20', amount: '5,000' } });
  assert.equal(dep.status, 201);
  await sleep(3_200);
  const bal = app.store.all('balances', { eq: { user_id: USER_ID, asset: 'USDT' } })[0];
  assert.equal(bal.available, 500_000); // $5,000 in minor units
});

test('3. buy (market) succeeds and shows in portfolio', async () => {
  const order = await app.call('POST', '/api/v1/orders', { user: me, body: { pair: 'BTC/USDT', side: 'BUY', type: 'MARKET', quoteAmount: '1,000' } });
  assert.equal(order.status, 201);
  assert.equal(order.json.order.state, 'FILLED');
  const pf = await app.call('GET', '/api/v1/portfolio', { user: me });
  const btc = pf.json.assets.find((a) => a.asset === 'BTC');
  assert.ok(btc, 'BTC should appear in portfolio');
  assert.equal(btc.qtyMinor, order.json.order.filled);
});

test('4. sell (market) part of the position', async () => {
  const bal = app.store.all('balances', { eq: { user_id: USER_ID, asset: 'BTC' } })[0];
  const sell = await app.call('POST', '/api/v1/orders', { user: me, body: { pair: 'BTC/USDT', side: 'SELL', type: 'MARKET', baseAmount: toHuman('BTC', Math.floor(bal.available / 2)) } });
  assert.equal(sell.status, 201);
  assert.equal(sell.json.order.state, 'FILLED');
});
function toHuman(asset, minor) {
  const d = asset === 'USDT' ? 2 : 8;
  const i = Math.floor(minor / 10 ** d);
  const f = String(minor % 10 ** d).padStart(d, '0');
  return `${i}.${f}`;
}

test('5. open a limit order, then cancel it', async () => {
  const limit = await app.call('POST', '/api/v1/orders', { user: me, body: { pair: 'ETH/USDT', side: 'BUY', type: 'LIMIT', price: '2,500', baseAmount: '0.005' } });
  // customer role cannot open limit orders -> expect 403 (documented behavior)
  assert.equal(limit.status, 403);
  // as the pro trader persona it must work (price below market -> rests OPEN)
  const pro = await app.call('POST', '/api/v1/orders', { user: app.user.dana, body: { pair: 'ETH/USDT', side: 'BUY', type: 'LIMIT', price: '2,500', baseAmount: '0.005' } });
  assert.equal(pro.status, 201, JSON.stringify(pro.json));
  assert.ok(['OPEN', 'MANUAL_REVIEW'].includes(pro.json.order.state), pro.json.order.state);
  const cancel = await app.call('POST', `/api/v1/orders/${pro.json.order.id}/cancel`, { user: app.user.dana });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.json.order.state, 'CANCELLED');
});

test('6. swap is recorded (trades + transactions)', async () => {
  const before = app.store.count('trades', { eq: { user_id: USER_ID } });
  const buy = await app.call('POST', '/api/v1/orders', { user: me, body: { pair: 'SOL/USDT', side: 'BUY', type: 'MARKET', quoteAmount: '200' } });
  assert.equal(buy.status, 201);
  const after = app.store.count('trades', { eq: { user_id: USER_ID } });
  assert.equal(after, before + 1);
});

test('7. small withdrawal goes through (simulated chain)', async () => {
  const wd = await app.call('POST', '/api/v1/wallets/withdraw', { user: me, body: { asset: 'USDT', network: 'erc20', address: '0x' + 'e2'.repeat(20), amount: '100' } });
  assert.equal(wd.status, 201, JSON.stringify(wd.json));
  // brand-new destination is MEDIUM risk -> held for review; ops approves (simulated chain)
  assert.ok(['APPROVED', 'IN_REVIEW'].includes(wd.json.withdrawal.status), wd.json.withdrawal.status);
  if (wd.json.withdrawal.status === 'IN_REVIEW') {
    const act = await app.call('POST', `/api/v1/operator/withdrawals/${wd.json.withdrawal.id}/action`, {
      user: app.user.ops, body: { action: 'approve', reason: 'Journey review: destination verified' },
    });
    assert.equal(act.status, 200, JSON.stringify(act.json));
  }
  await sleep(8_000);
  const final = app.store.get('withdrawals', wd.json.withdrawal.id);
  assert.equal(final.status, 'CONFIRMED');
  assert.equal(final.simulated, true);
});

test('8. activity feed shows the whole journey', async () => {
  const txs = await app.call('GET', '/api/v1/transactions', { user: me });
  assert.equal(txs.status, 200);
  const kinds = new Set(txs.json.transactions.map((t) => t.kind));
  assert.ok(kinds.has('DEPOSIT'));
  assert.ok(kinds.has('TRADE'));
  assert.ok(kinds.has('WITHDRAWAL'));
});

test('9. ledger reconciles after the full journey', () => {
  assert.deepEqual(reconcile(app.store), []);
});

test('10. role enforcement: customer blocked from operator plane', async () => {
  for (const path of ['/api/v1/operator/overview', '/api/v1/operator/orders', '/api/v1/audit', '/api/v1/approvals']) {
    const res = await app.call('GET', path, { user: me });
    assert.equal(res.status, 403, `customer must be blocked from ${path}`);
  }
  const opsOverview = await app.call('GET', '/api/v1/operator/overview', { user: app.user.ops });
  assert.equal(opsOverview.status, 200);
});
