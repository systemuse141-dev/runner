// Debug: hit a few endpoints and print bodies.
import { createServer } from '../src/index.js';

const config = {
  port: 0, host: '127.0.0.1', demoMode: true, store: 'memory', seed: true,
  sessionSecret: 'x',
  policy: {
    highValueUsdt: 25000, criticalValueUsdt: 125000, velocityWindowMs: 3600e3,
    velocityMedium: 3, velocityHigh: 5, securityChangeWindowMs: 72 * 3600e3,
    failedAttemptsThreshold: 3, orderAnomalyMultiplier: 5, orderAnomalyCriticalMultiplier: 20,
    orderAnomalyMinUsdt: 1000, minOrderNotionalUsdt: 10, minWithdrawalUsdt: 5,
    proposalTtlMs: 600000, sessionTtlMs: 43200e3,
    withdrawalMinUsdt: 50000, adjustmentHighRiskUsdt: 5000,
    marketControl: true, emergencyControl: true, feeChange: true,
  },
  rateLimits: { generalPerMin: 100000, authPerMin: 100000, withdrawPerMin: 1000 },
  corsOrigins: [],
};
const srv = await createServer({ config, quiet: false });
const base = `http://127.0.0.1:${srv.server.address().port}`;
const login = await fetch(base + '/api/v1/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'dana@novaex.demo', password: 'Nova-Demo-1' }),
});
const cookies = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const h = { cookie: cookies, 'X-CSRF-Token': /nx_csrf=([^;]+)/.exec(cookies)?.[1], 'Content-Type': 'application/json' };
const r1 = await fetch(base + '/api/v1/operator/overview', { headers: h });
console.log('overview', r1.status, JSON.stringify(await r1.json()).slice(0, 400));
const r2 = await fetch(base + '/api/v1/operator/orders/92832', { headers: h });
console.log('order92832', r2.status, JSON.stringify(await r2.json()).slice(0, 300));
await srv.close();
process.exit(0);
