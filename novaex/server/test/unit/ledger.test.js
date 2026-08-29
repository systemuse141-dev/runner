import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../../src/store/filestore.js';
import * as ledger from '../../src/domain/ledger.js';
import { accountBalance, reconcile } from '../../src/domain/ledger.js';
import { toMinor } from '../../../shared/money.js';

const store = () => createMemoryStore();
const U = 'user-1';

test('deposit credits user, debits house, entries sum to zero', () => {
  const s = store();
  const amt = toMinor('USDT', '1,000');
  ledger.ops.deposit(s, { uid: U, asset: 'USDT', amount: amt, idem: 'd1', ref: 'dep1' });
  assert.equal(accountBalance(s, ledger.acct.avail(U, 'USDT')), amt);
  assert.equal(accountBalance(s, ledger.acct.house('USDT')), -amt);
  const entries = s.all('ledger_entries', {});
  assert.equal(entries.reduce((x, e) => x + e.amount, 0), 0);
});

test('balances cache matches derived ledger balances', () => {
  const s = store();
  const amt = toMinor('USDT', '500');
  ledger.ops.deposit(s, { uid: U, asset: 'USDT', amount: amt, idem: 'd1', ref: 'dep1' });
  const bal = s.all('balances', { eq: { user_id: U, asset: 'USDT' } })[0];
  assert.equal(bal.available, amt);
  assert.equal(bal.reserved, 0);
  assert.deepEqual(reconcile(s), []);
});

test('withdrawal reserve moves available -> reserved; settle to house', () => {
  const s = store();
  const amt = toMinor('USDT', '1,000');
  ledger.ops.deposit(s, { uid: U, asset: 'USDT', amount: amt, idem: 'd1', ref: 'dep1' });
  const w = toMinor('USDT', '400');
  ledger.ops.withdrawalReserve(s, { uid: U, asset: 'USDT', amount: w, idem: 'w1r', ref: 'wd1' });
  assert.equal(s.all('balances', { eq: { user_id: U, asset: 'USDT' } })[0].available, amt - w);
  assert.equal(s.all('balances', { eq: { user_id: U, asset: 'USDT' } })[0].reserved, w);
  ledger.ops.withdrawalSettle(s, { uid: U, asset: 'USDT', amount: w, idem: 'w1s', ref: 'wd1' });
  assert.equal(s.all('balances', { eq: { user_id: U, asset: 'USDT' } })[0].reserved, 0);
  assert.equal(accountBalance(s, ledger.acct.house('USDT')), -amt + w);
  assert.deepEqual(reconcile(s), []);
});

test('overdraft is rejected with INSUFFICIENT_FUNDS', () => {
  const s = store();
  ledger.ops.deposit(s, { uid: U, asset: 'USDT', amount: toMinor('USDT', '100'), idem: 'd1', ref: 'dep1' });
  assert.throws(
    () => ledger.ops.withdrawalReserve(s, { uid: U, asset: 'USDT', amount: toMinor('USDT', '101'), idem: 'wX', ref: 'wdX' }),
    (e) => e.code === 'INSUFFICIENT_FUNDS'
  );
});

test('unbalanced entries are rejected', () => {
  const s = store();
  assert.throws(
    () => ledger.applyEntries(s, {
      operation: 'DEPOSIT', ref: 'bad',
      entries: [
        { account: ledger.acct.avail(U, 'USDT'), asset: 'USDT', amount: 100 },
        { account: ledger.acct.house('USDT'), asset: 'USDT', amount: -99 },
      ],
    }),
    (e) => e.code === 'UNBALANCED'
  );
});

test('idempotency: replaying the same key does not double-credit', () => {
  const s = store();
  const amt = toMinor('USDT', '777');
  const a = ledger.ops.deposit(s, { uid: U, asset: 'USDT', amount: amt, idem: 'same-key', ref: 'dep1' });
  const b = ledger.ops.deposit(s, { uid: U, asset: 'USDT', amount: amt, idem: 'same-key', ref: 'dep1' });
  assert.equal(a.replayed, false);
  assert.equal(b.replayed, true);
  assert.equal(accountBalance(s, ledger.acct.avail(U, 'USDT')), amt); // credited once
});

test('market fill moves both assets with fee to fees account', () => {
  const s = store();
  ledger.ops.deposit(s, { uid: U, asset: 'USDT', amount: toMinor('USDT', '10,000'), idem: 'd1', ref: 'dep1' });
  const qty = toMinor('BTC', '0.05');
  const price = 118_240_00; // 118,240 USDT in minor units
  const notional = Math.round((qty * price) / 1e8); // 5912 USDT
  const fee = 591; // ~0.1%
  ledger.ops.marketFill(s, { uid: U, base: 'BTC', quote: 'USDT', qty, notional, fee, side: 'BUY', idem: 'f1', ref: 'fill1' });
  const usdt = s.all('balances', { eq: { user_id: U, asset: 'USDT' } })[0];
  const btc = s.all('balances', { eq: { user_id: U, asset: 'BTC' } })[0];
  assert.equal(usdt.available, 1_000_000 - notional - fee);
  assert.equal(btc.available, qty);
  assert.equal(accountBalance(s, ledger.acct.fees('USDT')), fee);
  assert.deepEqual(reconcile(s), []);
});

test('reserve + maker fill + cancel-release keeps everything consistent', () => {
  const s = store();
  ledger.ops.deposit(s, { uid: U, asset: 'USDT', amount: toMinor('USDT', '10,000'), idem: 'd1', ref: 'dep1' });
  const notional = 400_000; // 4,000 USDT
  const fee = 280; // 7bps
  ledger.ops.reserveForOrder(s, { uid: U, asset: 'USDT', amount: notional + fee, idem: 'r1', ref: 'ord1' });
  assert.equal(s.all('balances', { eq: { user_id: U, asset: 'USDT' } })[0].reserved, notional + fee);
  // partial fill (half)
  const pNotional = 200_000, pFee = 140, pQty = 3;
  ledger.ops.makerFill(s, { uid: U, base: 'BTC', quote: 'USDT', notional: pNotional, qty: pQty, fee: pFee, side: 'BUY', idem: 'mf1', ref: 'ord1' });
  // cancel the rest
  const remaining = notional + fee - (pNotional + pFee);
  ledger.ops.unreserve(s, { uid: U, asset: 'USDT', amount: remaining, idem: 'u1', ref: 'ord1' });
  const bal = s.all('balances', { eq: { user_id: U, asset: 'USDT' } })[0];
  assert.equal(bal.available, 1_000_000 - pNotional - pFee);
  assert.equal(bal.reserved, 0);
  assert.equal(s.all('balances', { eq: { user_id: U, asset: 'BTC' } })[0].available, pQty);
  assert.deepEqual(reconcile(s), []);
});

test('reconcile detects tampering with the materialized cache', () => {
  const s = store();
  ledger.ops.deposit(s, { uid: U, asset: 'USDT', amount: toMinor('USDT', '100'), idem: 'd1', ref: 'dep1' });
  const bal = s.all('balances', { eq: { user_id: U, asset: 'USDT' } })[0];
  s.update('balances', bal.id, { available: 999_999 }); // tamper
  const drift = reconcile(s);
  assert.ok(drift.length > 0, 'drift should be detected');
});

test('ledger entries and operations are append-only', () => {
  const s = store();
  ledger.ops.deposit(s, { uid: U, asset: 'USDT', amount: toMinor('USDT', '10'), idem: 'd1', ref: 'dep1' });
  const entry = s.all('ledger_entries', {})[0];
  assert.throws(() => s.update('ledger_entries', entry.id, { amount: 0 }), (e) => e.name === 'AppendOnlyError');
  assert.throws(() => s.remove('ledger_entries', entry.id), (e) => e.name === 'AppendOnlyError');
  const op = s.all('ledger_operations', {})[0];
  assert.throws(() => s.update('ledger_operations', op.id, { memo: 'x' }), (e) => e.name === 'AppendOnlyError');
});
