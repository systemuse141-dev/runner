// Shared test helpers: boots the full server on an ephemeral port (memory store).
import { createServer } from '../src/index.js';

export const TEST_PASSWORD = 'Nova-Demo-1';

export function testConfig(overrides = {}) {
  return {
    port: 0,
    host: '127.0.0.1',
    demoMode: true,
    store: 'memory',
    seed: true,
    sessionSecret: 'test-secret',
    policy: {
      highValueUsdt: 25_000,
      criticalValueUsdt: 125_000,
      velocityWindowMs: 3600e3,
      velocityMedium: 3,
      velocityHigh: 5,
      securityChangeWindowMs: 72 * 3600e3,
      failedAttemptsThreshold: 3,
      orderAnomalyMultiplier: 5,
      orderAnomalyCriticalMultiplier: 20,
      orderAnomalyMinUsdt: 1000,
      minOrderNotionalUsdt: 10,
      minWithdrawalUsdt: 5,
      proposalTtlMs: 600_000,
      sessionTtlMs: 43_200_000,
      withdrawalMinUsdt: 50_000,
      adjustmentHighRiskUsdt: 5_000,
      marketControl: true,
      emergencyControl: true,
      feeChange: true,
    },
    rateLimits: { generalPerMin: 100_000, authPerMin: 12, withdrawPerMin: 100 },
    corsOrigins: [],
    ...overrides,
  };
}

export async function startApp(overrides = {}) {
  const config = testConfig(overrides);
  const srv = await createServer({ config, quiet: true });
  const base = `http://127.0.0.1:${srv.server.address().port}`;
  const api = {
    base,
    srv,
    store: srv.store,
    ctx: srv.ctx,
    async call(method, path, { user, body, headers = {} } = {}) {
      const baseHeaders = user ? user.headers : {};
      const opts = { method, headers: { 'Content-Type': 'application/json', ...baseHeaders, ...headers } };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(base + path, opts);
      let json = null;
      try { json = await res.json(); } catch { /* no body */ }
      return { status: res.status, json, res };
    },
    async login(email, password = TEST_PASSWORD, extraHeaders = {}) {
      const res = await fetch(base + '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify({ email, password }),
      });
      const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
      const headers = {
        cookie: cookies,
        'X-CSRF-Token': /nx_csrf=([^;]+)/.exec(cookies)?.[1] ?? '',
        'Content-Type': 'application/json',
      };
      return { headers, cookies };
    },
    user: {},
    sleep,
  };
  for (const email of ['alice@novaex.demo', 'dana@novaex.demo', 'greg@novaex.demo', 'ops@novaex.demo', 'maya@novaex.demo']) {
    api.user[email.split('@')[0]] = await api.login(email);
  }
  return api;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
