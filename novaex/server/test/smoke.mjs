// Manual smoke script (not part of the test suite): node server/test/smoke.mjs
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

const srv = await createServer({ config, quiet: true });
const base = `http://127.0.0.1:${srv.server.address().port}`;
const j = (r) => r.json();
let failed = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failed++;
};

async function login(email) {
  const res = await fetch(base + '/api/v1/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Nova-Demo-1' }),
  });
  const body = await res.json();
  const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const headers = { cookie: cookies, 'X-CSRF-Token': /nx_csrf=([^;]+)/.exec(cookies)?.[1], 'Content-Type': 'application/json' };
  return { status: res.status, body, headers };
}

check('health', (await (await fetch(base + '/health')).json()).ok === true);

const dana = await login('dana@novaex.demo');
check('login dana (trader)', dana.status === 200 && dana.body.user?.role === 'trader');
const maya = await login('maya@novaex.demo');
check('login maya (admin)', maya.status === 200 && maya.body.user?.role === 'admin');

const port = await fetch(base + '/api/v1/portfolio', { headers: dana.headers }).then(j);
check('portfolio', port.totalUsdMinor > 0 && port.assets.length > 2 && port.series.length > 10, `total=${port.totalUsdMinor} assets=${port.assets?.length}`);

const wo = await fetch(base + '/api/v1/operator/overview', { headers: maya.headers }).then(j);
check('ops overview', wo.live && wo.health.length === 8 && wo.attentionQueue.length > 3, `queue=${wo.attentionQueue?.length}`);

const traderBlocked = await fetch(base + '/api/v1/operator/overview', { headers: dana.headers });
check('RBAC: trader blocked from ops', traderBlocked.status === 403);

const order = await fetch(base + '/api/v1/operator/orders/92832', { headers: maya.headers }).then(j);
check('order 92832 flagged', order.order?.num === 92832 && order.order?.state === 'MANUAL_REVIEW' && order.riskEvents.length === 1, `state=${order.order?.state}`);

const create = await fetch(base + '/api/v1/orders', {
  method: 'POST', headers: dana.headers,
  body: JSON.stringify({ pair: 'SOL/USDT', side: 'BUY', type: 'LIMIT', price: '195', baseAmount: '5' }),
}).then(j);
check('create limit order', create.order?.state === 'OPEN' || create.order?.state === 'MANUAL_REVIEW', JSON.stringify(create).slice(0, 120));

const mkt = await fetch(base + '/api/v1/orders', {
  method: 'POST', headers: dana.headers,
  body: JSON.stringify({ pair: 'ETH/USDT', side: 'BUY', type: 'MARKET', quoteAmount: '200' }),
}).then(j);
check('market buy fills', mkt.order?.state === 'FILLED' && mkt.order?.filled > 0, JSON.stringify(mkt).slice(0, 140));

const ai = await fetch(base + '/api/v1/ai/chat', { method: 'POST', headers: maya.headers, body: JSON.stringify({ message: 'Why is order 92832 flagged?' }) }).then(j);
check('ai explains order', /R6_ORDER_ANOMALY|Order size anomaly/.test(ai.text), ai.text.slice(0, 80));

const aiSum = await fetch(base + '/api/v1/ai/chat', { method: 'POST', headers: maya.headers, body: JSON.stringify({ message: 'Summarize the last hour' }) }).then(j);
check('ai summarizes', /snapshot|Orders created/i.test(aiSum.text), aiSum.text.slice(0, 60));

const ai2 = await fetch(base + '/api/v1/ai/chat', { method: 'POST', headers: maya.headers, body: JSON.stringify({ message: 'Pause the BTC market' }) }).then(j);
const prop = ai2.blocks?.find((b) => b.kind === 'proposal');
check('ai proposes (no execution)', !!prop && prop.data.status === 'PENDING', JSON.stringify(ai2.blocks?.map((b) => b.kind)));

const auth = await fetch(base + '/api/v1/ai/proposals/' + prop.data.id + '/authorize', { method: 'POST', headers: maya.headers }).then(j);
check('ai dual approval routing', auth.dual === true && auth.approval?.status === 'PENDING', JSON.stringify(auth).slice(0, 100));

const selfApprove = await fetch(base + '/api/v1/approvals/' + auth.approval.id + '/approve', { method: 'POST', headers: maya.headers, body: JSON.stringify({ reason: 'self' }) }).then(j);
check('self-approval blocked', selfApprove.error?.code === 'SELF_APPROVAL', JSON.stringify(selfApprove).slice(0, 80));

// second operator completes the two-person rule (requester maya + ops)
const ops = await login('ops@novaex.demo');
const approve1 = await fetch(base + '/api/v1/approvals/' + auth.approval.id + '/approve', { method: 'POST', headers: ops.headers, body: JSON.stringify({ reason: 'second-person approval' }) }).then(j);
check('dual approval executes', approve1.approval?.status === 'EXECUTED' && approve1.approval?.approvals?.length === 2, JSON.stringify(approve1).slice(0, 120));

const reapprove = await fetch(base + '/api/v1/approvals/' + auth.approval.id + '/approve', { method: 'POST', headers: maya.headers, body: JSON.stringify({ reason: 'again' }) }).then(j);
check('re-approval rejected (already executed)', reapprove.error?.code === 'BAD_STATUS');

const mctrl = await fetch(base + '/api/v1/operator/markets', { headers: maya.headers }).then(j);
const btc = mctrl.markets?.find((m) => m.pair === 'BTC/USDT');
check('market paused after approval', btc?.control?.state === 'PAUSED', JSON.stringify(btc?.control));

const audit = await fetch(base + '/api/v1/audit', { headers: maya.headers }).then(j);
check('audit trail populated', audit.events.length > 5 && audit.events.some((e) => e.action === 'approval.executed'));

await srv.close();
console.log(failed ? `SMOKE: ${failed} FAILURES` : 'SMOKE: ALL OK');
process.exit(failed ? 1 : 0);
