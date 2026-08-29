import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, sleep } from '../helpers.js';
import { reconcile } from '../../src/domain/ledger.js';

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.srv.close(); });

test('deposit flow: pending -> confirmed (simulated) -> balance credited', async () => {
  const alice = app.user.alice;
  const beforeBal = app.store.all('balances', { eq: { user_id: 'u_alice', asset: 'ETH' } })[0]?.available ?? 0;
  const res = await app.call('POST', '/api/v1/wallets/deposit', { user: alice, body: { asset: 'ETH', network: 'erc20', amount: '0.5' } });
  assert.equal(res.status, 201);
  assert.equal(res.json.deposit.status, 'PENDING');

  await sleep(3_200); // simulated confirmations
  const dep = app.store.get('deposits', res.json.deposit.id);
  assert.equal(dep.status, 'CONFIRMED');
  assert.equal(dep.simulated, true);
  const afterBal = app.store.all('balances', { eq: { user_id: 'u_alice', asset: 'ETH' } })[0].available;
  assert.equal(afterBal, beforeBal + 50_000_000); // 0.5 ETH in minor units
  assert.deepEqual(reconcile(app.store), []);
});

test('deposit to unsupported network is rejected', async () => {
  const res = await app.call('POST', '/api/v1/wallets/deposit', { user: app.user.alice, body: { asset: 'BTC', network: 'erc20', amount: '0.1' } });
  assert.equal(res.status, 400);
});

test('low-risk small withdrawal auto-approves and settles (simulated)', async () => {
  const dana = app.user.dana;
  // a destination dana has used before (seeded) -> not a new destination -> LOW risk
  const knownAddr = `0x${'a1'.repeat(12)}danaNew`;
  const before = app.store.all('balances', { eq: { user_id: 'u_dana', asset: 'USDT' } })[0];
  const res = await app.call('POST', '/api/v1/wallets/withdraw', {
    user: dana,
    body: { asset: 'USDT', network: 'erc20', address: knownAddr, amount: '100' },
  });
  assert.equal(res.status, 201);
  const wd = res.json.withdrawal;
  assert.equal(wd.risk_level, 'LOW');
  assert.equal(wd.status, 'APPROVED');
  // funds moved to reserved
  const during = app.store.all('balances', { eq: { user_id: 'u_dana', asset: 'USDT' } })[0];
  assert.equal(during.available, before.available - 10_000);
  assert.equal(during.reserved, before.reserved + 10_000);

  await sleep(7_000); // simulated broadcast + confirmation
  const final = app.store.get('withdrawals', wd.id);
  assert.equal(final.status, 'CONFIRMED');
  assert.equal(final.simulated, true);
  assert.match(final.tx_hash, /^0xsim/);
  assert.equal(app.store.all('balances', { eq: { user_id: 'u_dana', asset: 'USDT' } })[0].reserved, before.reserved);
  assert.deepEqual(reconcile(app.store), []);
});

test('high-value new-destination withdrawal is held for dual review', async () => {
  const dana = app.user.dana;
  // fund enough for a >50k dual-control withdrawal
  const dep = await app.call('POST', '/api/v1/wallets/deposit', {
    user: dana, body: { asset: 'USDT', network: 'erc20', amount: '150,000', address: '0x' + '77'.repeat(20) + 'fund4' },
  });
  assert.equal(dep.status, 201);
  await sleep(3400);
  const before = app.store.all('balances', { eq: { user_id: 'u_dana', asset: 'USDT' } })[0];
  const res = await app.call('POST', '/api/v1/wallets/withdraw', {
    user: dana,
    body: { asset: 'USDT', network: 'erc20', address: '0x' + 'f1'.repeat(20) + 'newdest', amount: '60,000' },
  });
  assert.equal(res.status, 201);
  const wd = res.json.withdrawal;
  assert.ok(['HIGH', 'CRITICAL'].includes(wd.risk_level));
  assert.equal(wd.status, 'IN_REVIEW');
  assert.equal(wd.required_approvals, 2);
  const risk = app.store.get('risk_events', wd.risk_event);
  assert.ok(risk.rules.some((r) => r.id === 'R1_HIGH_VALUE'));
  assert.ok(risk.rules.some((r) => r.id === 'R3_NEW_DESTINATION'));
  const during = app.store.all('balances', { eq: { user_id: 'u_dana', asset: 'USDT' } })[0];
  assert.equal(during.available, before.available - 6_000_000);
  // operator cannot settle it with a single approval
  const one = await app.call('POST', `/api/v1/operator/withdrawals/${wd.id}/action`, {
    user: app.user.ops, body: { action: 'approve', reason: 'first' },
  });
  assert.equal(one.status, 200);
  assert.notEqual(one.json.withdrawal.status, 'APPROVED');
  const two = await app.call('POST', `/api/v1/operator/withdrawals/${wd.id}/action`, {
    user: app.user.maya, body: { action: 'approve', reason: 'second' },
  });
  assert.equal(two.json.withdrawal.status, 'APPROVED');
  assert.deepEqual(reconcile(app.store), []);
});

test('operator can reject a withdrawal; funds return to available', async () => {
  const alice = app.user.alice;
  const before = app.store.all('balances', { eq: { user_id: 'u_alice', asset: 'USDT' } })[0];
  const res = await app.call('POST', '/api/v1/wallets/withdraw', {
    user: alice,
    body: { asset: 'USDT', network: 'trc20', address: 'T' + 'nova'.repeat(8) + 'newalice', amount: '2,000' },
  });
  assert.equal(res.status, 201);
  const wd = res.json.withdrawal;
  assert.equal(wd.status, 'IN_REVIEW'); // new destination -> MEDIUM
  const rej = await app.call('POST', `/api/v1/operator/withdrawals/${wd.id}/action`, {
    user: app.user.ops, body: { action: 'reject', reason: 'address mismatch with records' },
  });
  assert.equal(rej.status, 200);
  assert.equal(rej.json.withdrawal.status, 'REJECTED');
  const after = app.store.all('balances', { eq: { user_id: 'u_alice', asset: 'USDT' } })[0];
  assert.equal(after.available, before.available);
  assert.equal(after.reserved, before.reserved);
  assert.deepEqual(reconcile(app.store), []);
});

test('operator hold/release cycle', async () => {
  const alice = app.user.alice;
  const res = await app.call('POST', '/api/v1/wallets/withdraw', {
    user: alice,
    body: { asset: 'USDT', network: 'trc20', address: 'T' + 'hold'.repeat(8) + 'holdme', amount: '1,200' },
  });
  const wd = res.json.withdrawal;
  const hold = await app.call('POST', `/api/v1/operator/withdrawals/${wd.id}/action`, { user: app.user.ops, body: { action: 'hold', reason: 'manual check' } });
  assert.equal(hold.json.withdrawal.status, 'HELD');
  const release = await app.call('POST', `/api/v1/operator/withdrawals/${wd.id}/action`, { user: app.user.ops, body: { action: 'release', reason: 'cleared' } });
  assert.equal(release.json.withdrawal.status, 'IN_REVIEW');
});

test('invalid address format and insufficient balance are rejected', async () => {
  const badAddr = await app.call('POST', '/api/v1/wallets/withdraw', {
    user: app.user.alice,
    body: { asset: 'BTC', network: 'bitcoin', address: 'not-an-address', amount: '0.01' },
  });
  assert.equal(badAddr.status, 400);
  const poor = await app.call('POST', '/api/v1/wallets/withdraw', {
    user: app.user.greg,
    body: { asset: 'USDT', network: 'erc20', address: '0x' + 'ab'.repeat(20) + 'poor', amount: '999,999' },
  });
  assert.equal(poor.status, 400);
});
