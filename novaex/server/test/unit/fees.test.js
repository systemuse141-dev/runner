import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FeeEngine } from '../../src/domain/fees.js';
import { FEE_TIERS } from '../../../shared/contracts.js';

const eng = new FeeEngine(FEE_TIERS);

test('tier selection by 30d volume', () => {
  assert.equal(eng.tierFor(0).id, 'T0');
  assert.equal(eng.tierFor(49_999).id, 'T0');
  assert.equal(eng.tierFor(50_000).id, 'T1');
  assert.equal(eng.tierFor(250_000).id, 'T2');
  assert.equal(eng.tierFor(1e9).id, 'T2');
});

test('taker fee = notional * bps, rounded up to minor units', () => {
  const r = eng.compute(1_000_000, 'taker', 0); // 10,000 USDT, T0
  assert.equal(r.feeMinor, 1_000); // 0.10% = 10 USDT
  assert.equal(r.tier.id, 'T0');
});

test('maker fee is cheaper than taker', () => {
  const taker = eng.compute(1_000_000, 'taker', 0);
  const maker = eng.compute(1_000_000, 'maker', 0);
  assert.ok(maker.feeMinor < taker.feeMinor);
  assert.equal(maker.feeMinor, 700); // 7bps
});

test('fee rounding never under-collects (round up)', () => {
  // 999.99 USDT * 10bps = 0.99999 USDT = 99.999 minor -> 100 minor
  assert.equal(eng.compute(99_999, 'taker', 0).feeMinor, 100);
});

test('vip tier lowers fees', () => {
  const low = eng.compute(1_000_000, 'taker', 0);
  const high = eng.compute(1_000_000, 'taker', 300_000);
  assert.ok(high.feeMinor < low.feeMinor);
  assert.equal(high.tier.id, 'T2');
});
