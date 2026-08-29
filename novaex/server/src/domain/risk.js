// Deterministic policy/risk rules. Same inputs => same outputs.
// The AI may explain these rules but can never invent events.

import { POLICY } from '../../../shared/contracts.js';

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const RISK_RULES = {
  R1_HIGH_VALUE: {
    id: 'R1_HIGH_VALUE',
    name: 'High-value transfer',
    severity: 3,
    description: 'Transfer value exceeds the high-value threshold set by policy.',
    check(ctx) {
      if (ctx.amountUsdt == null) return null;
      if (ctx.amountUsdt >= POLICY.criticalValueUsdt)
        return { severity: 4, detail: `Value ${ctx.amountUsdt.toLocaleString()} USDT ≥ critical threshold ${POLICY.criticalValueUsdt.toLocaleString()} USDT.` };
      if (ctx.amountUsdt >= POLICY.highValueUsdt)
        return { severity: 3, detail: `Value ${ctx.amountUsdt.toLocaleString()} USDT ≥ high-value threshold ${POLICY.highValueUsdt.toLocaleString()} USDT.` };
      return null;
    },
  },
  R2_VELOCITY: {
    id: 'R2_VELOCITY',
    name: 'Unusual velocity',
    severity: 2,
    description: 'More outbound transfers than expected within a rolling one-hour window.',
    check(ctx) {
      const n = ctx.withdrawalsInWindow ?? 0;
      if (n >= POLICY.velocityHigh) return { severity: 3, detail: `${n} withdrawals in the last hour (threshold ${POLICY.velocityHigh}).` };
      if (n >= POLICY.velocityMedium) return { severity: 2, detail: `${n} withdrawals in the last hour (threshold ${POLICY.velocityMedium}).` };
      return null;
    },
  },
  R3_NEW_DESTINATION: {
    id: 'R3_NEW_DESTINATION',
    name: 'New destination',
    severity: 2,
    description: 'First transfer ever seen to this destination address.',
    check(ctx) {
      if (ctx.isNewDestination) return { severity: 2, detail: 'This destination address has never been used on this account.' };
      return null;
    },
  },
  R4_SECURITY_CHANGE: {
    id: 'R4_SECURITY_CHANGE',
    name: 'Recent security change',
    severity: 2,
    description: 'Account security was changed (2FA, password) within the last 72 hours.',
    check(ctx) {
      if (ctx.recentSecurityChange) return { severity: 2, detail: 'A security setting changed within the last 72 hours.' };
      return null;
    },
  },
  R5_REPEATED_FAILURES: {
    id: 'R5_REPEATED_FAILURES',
    name: 'Repeated authentication failures',
    severity: 2,
    description: 'Multiple failed login or 2FA attempts from this account.',
    check(ctx) {
      const n = ctx.failedAttempts ?? 0;
      if (n >= POLICY.failedAttemptsThreshold)
        return { severity: 2, detail: `${n} failed authentication attempts in the last 24 hours.` };
      return null;
    },
  },
  R6_ORDER_ANOMALY: {
    id: 'R6_ORDER_ANOMALY',
    name: 'Order size anomaly',
    severity: 3,
    description: 'Order notional far above the account’s own 30-day average order size.',
    check(ctx) {
      if (ctx.orderNotionalUsdt == null || ctx.avgOrderNotionalUsdt == null) return null;
      if (ctx.orderNotionalUsdt < POLICY.orderAnomalyMinUsdt) return null;
      const avg = Math.max(ctx.avgOrderNotionalUsdt, 1);
      const ratio = ctx.orderNotionalUsdt / avg;
      if (ratio >= POLICY.orderAnomalyCriticalMultiplier)
        return { severity: 4, detail: `Order is ${ratio.toFixed(1)}× the 30-day average order size (${ctx.avgOrderNotionalUsdt.toLocaleString()} USDT).` };
      if (ratio >= POLICY.orderAnomalyMultiplier)
        return { severity: 3, detail: `Order is ${ratio.toFixed(1)}× the 30-day average order size (${ctx.avgOrderNotionalUsdt.toLocaleString()} USDT).` };
      return null;
    },
  },
  R7_MARKET_ANOMALY: {
    id: 'R7_MARKET_ANOMALY',
    name: 'Market data anomaly',
    severity: 2,
    description: 'Spread or short-term volatility on a market deviated from its normal range.',
    check(ctx) {
      if (ctx.spreadRatio != null && ctx.spreadRatio >= 4)
        return { severity: 2, detail: `Spread is ${ctx.spreadRatio.toFixed(1)}× its recent average.` };
      if (ctx.volatilityRatio != null && ctx.volatilityRatio >= 3)
        return { severity: 2, detail: `5-minute volatility is ${ctx.volatilityRatio.toFixed(1)}× its recent average.` };
      return null;
    },
  },
  R8_OPERATIONAL_ANOMALY: {
    id: 'R8_OPERATIONAL_ANOMALY',
    name: 'Operational anomaly',
    severity: 3,
    description: 'A service or queue reported repeated failures within the observation window.',
    check(ctx) {
      const n = ctx.failedOperations ?? 0;
      if (n >= 5) return { severity: 3, detail: `${n} failed operations in the last 15 minutes.` };
      if (n >= 3) return { severity: 2, detail: `${n} failed operations in the last 15 minutes.` };
      return null;
    },
  },
};

/**
 * Evaluate all rules against a context. Deterministic.
 * level = max severity; ties broken by count of triggered rules.
 * Returns { level, score, rules: [{id,name,severity,detail}] }
 */
export function assessRisk(ctx = {}) {
  const rules = [];
  for (const rule of Object.values(RISK_RULES)) {
    let hit = null;
    try {
      hit = rule.check(ctx);
    } catch {
      hit = null;
    }
    if (hit) rules.push({ id: rule.id, name: rule.name, severity: hit.severity, detail: hit.detail });
  }
  const max = rules.reduce((m, r) => Math.max(m, r.severity), 0);
  const count = rules.length;
  let level = 'LOW';
  if (max >= 4 || (max >= 3 && count >= 2)) level = 'CRITICAL';
  else if (max >= 3) level = 'HIGH';
  else if (max >= 2 || count >= 2) level = 'MEDIUM';
  const score = max * 100 + count * 10;
  return { level, score, rules };
}

export function levelRank(level) {
  return RISK_LEVELS.indexOf(level);
}
