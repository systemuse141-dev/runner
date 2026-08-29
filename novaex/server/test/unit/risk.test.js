import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessRisk, RISK_RULES } from '../../src/domain/risk.js';
import { POLICY } from '../../../shared/contracts.js';

test('empty context is LOW with no rules', () => {
  const r = assessRisk({});
  assert.equal(r.level, 'LOW');
  assert.deepEqual(r.rules, []);
});

test('R1 high-value thresholds', () => {
  const high = assessRisk({ amountUsdt: POLICY.highValueUsdt });
  assert.equal(high.level, 'HIGH');
  assert.ok(high.rules.some((x) => x.id === 'R1_HIGH_VALUE'));
  const crit = assessRisk({ amountUsdt: POLICY.criticalValueUsdt });
  assert.equal(crit.level, 'CRITICAL');
  const low = assessRisk({ amountUsdt: 100 });
  assert.equal(low.level, 'LOW');
});

test('R2 velocity thresholds', () => {
  assert.equal(assessRisk({ withdrawalsInWindow: 2 }).level, 'LOW');
  assert.equal(assessRisk({ withdrawalsInWindow: POLICY.velocityMedium }).level, 'MEDIUM');
  assert.equal(assessRisk({ withdrawalsInWindow: POLICY.velocityHigh }).level, 'HIGH');
});

test('R3 new destination is MEDIUM alone, escalates with value', () => {
  assert.equal(assessRisk({ isNewDestination: true }).level, 'MEDIUM');
  const combined = assessRisk({ isNewDestination: true, amountUsdt: POLICY.highValueUsdt });
  assert.ok(['HIGH', 'CRITICAL'].includes(combined.level));
});

test('R4/R5 security signals', () => {
  assert.equal(assessRisk({ recentSecurityChange: true }).level, 'MEDIUM');
  assert.equal(assessRisk({ failedAttempts: POLICY.failedAttemptsThreshold }).level, 'MEDIUM');
});

test('R6 order anomaly multipliers', () => {
  const high = assessRisk({ orderNotionalUsdt: 10_000, avgOrderNotionalUsdt: 1_000 });
  assert.equal(high.level, 'HIGH');
  const crit = assessRisk({ orderNotionalUsdt: 20_000, avgOrderNotionalUsdt: 1_000 });
  assert.equal(crit.level, 'CRITICAL');
  const small = assessRisk({ orderNotionalUsdt: 500, avgOrderNotionalUsdt: 1_000 });
  assert.equal(small.level, 'LOW'); // below min notional floor
});

test('determinism: same input, same output, every time', () => {
  const ctx = { amountUsdt: 30_000, isNewDestination: true, withdrawalsInWindow: 3, recentSecurityChange: true };
  const a = assessRisk(ctx);
  const b = assessRisk({ ...ctx });
  assert.deepEqual(a, b);
});

test('every rule has id/name/description (for AI explanations)', () => {
  for (const r of Object.values(RISK_RULES)) {
    assert.ok(r.id && r.name && r.description);
    assert.ok(r.check({} ) == null || typeof r.check({}).detail === 'string');
  }
});

test('stored rule details reference the actual numbers', () => {
  const r = assessRisk({ amountUsdt: 60_000, isNewDestination: true });
  const r1 = r.rules.find((x) => x.id === 'R1_HIGH_VALUE');
  assert.match(r1.detail, /60,000/);
});
