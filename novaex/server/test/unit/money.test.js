import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMinor, toHuman, mulBps, add, fmtMoney, MoneyError } from '../../../shared/money.js';

test('toMinor parses decimal strings into exact integer minor units', () => {
  assert.equal(toMinor('USDT', '1234.5'), 123450);
  assert.equal(toMinor('USDT', '0.01'), 1);
  assert.equal(toMinor('BTC', '0.00000001'), 1);
  assert.equal(toMinor('BTC', '1.5'), 150_000_000);
  assert.equal(toMinor('USDT', '-10.25'), -1025);
});

test('toMinor accepts thousands separators and rejects garbage', () => {
  assert.equal(toMinor('USDT', '1,234.5'), 123450);
  assert.throws(() => toMinor('USDT', 'abc'), MoneyError);
  assert.throws(() => toMinor('USDT', '1..2'), MoneyError);
  assert.throws(() => toMinor('USDT', ''), MoneyError);
  assert.throws(() => toMinor('USDT', '--5'), MoneyError);
});

test('toMinor rejects precision beyond asset decimals', () => {
  assert.throws(() => toMinor('USDT', '0.001'), MoneyError);
  assert.equal(toMinor('USDT', '0.00'), 0);
});

test('no float drift: 0.1 + 0.2 is exact', () => {
  const a = toMinor('USDT', '0.1');
  const b = toMinor('USDT', '0.2');
  assert.equal(add(a, b), 30); // would be 30.000000000000004 with floats
  // large repeated addition stays exact (10,000 * 10 cents = 100,000 cents)
  let sum = 0;
  for (let i = 0; i < 10_000; i++) sum = add(sum, toMinor('USDT', '0.1'));
  assert.equal(sum, 100_000);
});

test('toHuman round-trips', () => {
  assert.equal(toHuman('USDT', 123450), '1234.50');
  assert.equal(toHuman('BTC', 150_000_000), '1.50000000');
  assert.equal(toHuman('USDT', -1025), '-10.25');
  const rt = toMinor('ETH', toHuman('ETH', 12_345_678_901));
  assert.equal(rt, 12_345_678_901);
});

test('mulBps with explicit rounding modes', () => {
  assert.equal(mulBps(1_000_000, 10), 1000); // 10bps half_up
  assert.equal(mulBps(999_999, 10, 'up'), 1000); // rounds away from zero
  assert.equal(mulBps(999_999, 10, 'down'), 999);
  assert.equal(mulBps(-1_000_001, 10, 'up'), -1001);
  assert.equal(mulBps(1, 3, 'half_up'), 0); // 0.0003 -> 0
  assert.equal(mulBps(1, 5000, 'half_up'), 1); // exactly 0.5 -> 1 (half up)
});

test('mulBps is safe for large values (BigInt underneath)', () => {
  const big = 9_000_000_000_000; // 90M USDT in minor units
  assert.equal(mulBps(big, 10), 9_000_000_000);
  assert.equal(Number.isSafeInteger(mulBps(big, 10)), true);
});

test('fmtMoney formats with separators', () => {
  assert.equal(fmtMoney('USDT', 1_234_5678, { prefix: '$' }), '$123,456.78');
  assert.equal(fmtMoney('BTC', 123_456_789, { forceDecimals: true }), '1.23456789');
});
