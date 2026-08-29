import { Router } from 'express';
import { ORDER_ACTIONS } from '../../../../shared/contracts.js';
import { requirePerm } from '../../middleware/index.js';
import { can, PermissionError } from '../../domain/rbac.js';

const ORDER_ACTION_PERM = {
  cancel: 'orders:act:cancel',
  pause: 'orders:act:pause',
  resume: 'orders:act:resume',
  amend: 'orders:act:amend',
  hold_for_review: 'orders:act:hold',
  release_review: 'orders:act:review',
  reject_review: 'orders:act:review',
};

export function operatorRoutes(ctx) {
  const { store, trading, wallets, risk, users, system, marketOps, adjustments, approvals, audit, markets } = ctx;
  const r = Router();
  // the whole operator plane is permission-gated (operator/admin hold these)
  r.use(requirePerm('ops:read'));

  // ---- overview ----------------------------------------------------------
  r.get('/overview', async (req, res) => {
    const reviews = store.all('manual_reviews', { eq: { status: 'OPEN' } });
    const withdrawals = store.all('withdrawals', { limit: 500 });
    const pendingWd = withdrawals.filter((w) => ['IN_REVIEW', 'HELD'].includes(w.status));
    const orders = store.all('orders', { limit: 2000 });
    const openOrders = orders.filter((o) => ['OPEN', 'PARTIALLY_FILLED', 'MANUAL_REVIEW', 'VALIDATING'].includes(o.state));
    const riskStats = await risk.stats();
    const approvals = store.all('approval_requests', { eq: { status: 'PENDING' } });

    // attention queue: unified, prioritized
    const queue = [];
    for (const rev of reviews) {
      queue.push({ sev: rev.level === 'CRITICAL' ? 4 : rev.level === 'HIGH' ? 3 : 2, kind: 'manual_review', id: rev.entity_id, kindLabel: rev.kind, title: `${rev.kind} ${rev.entity_id} needs review`, sub: rev.reason ?? null, ts: rev.ts, url: rev.kind === 'order' ? `/ops/orders?focus=${rev.entity_id}` : rev.kind === 'withdrawal' ? `/ops/withdrawals?focus=${rev.entity_id}` : '/ops/adjustments' });
    }
    for (const w of pendingWd) {
      if (['HIGH', 'CRITICAL'].includes(w.risk_level) || w.required_approvals > 1) {
        queue.push({ sev: w.risk_level === 'CRITICAL' ? 4 : 3, kind: 'withdrawal', id: w.id, kindLabel: 'withdrawal', title: `${w.id} ${w.risk_level} withdrawal pending`, sub: `${w.asset} ${w.required_approvals > 1 ? `· dual approval ${w.approvals.length}/${w.required_approvals}` : ''}`, ts: w.ts, url: `/ops/withdrawals?focus=${w.id}` });
      }
    }
    for (const e of store.all('risk_events', { eq: { status: 'OPEN' }, limit: 100 })) {
      if (['HIGH', 'CRITICAL'].includes(e.level)) queue.push({ sev: e.level === 'CRITICAL' ? 4 : 3, kind: 'risk', id: e.id, kindLabel: 'risk', title: `${e.level} risk — ${e.type}`, sub: e.rules.map((x) => x.name).join('; '), ts: e.ts, url: `/ops/risk?focus=${e.id}` });
    }
    for (const a of approvals) queue.push({ sev: 3, kind: 'approval', id: a.id, kindLabel: 'approval', title: `Approval ${a.id} pending`, sub: `${a.scope} · ${a.action}`, ts: a.ts, url: `/ops/approvals?focus=${a.id}` });
    queue.sort((a, b) => b.sev - a.sev || b.ts - a.ts);

    const volume = store.all('trades', { gte: { ts: Date.now() - 86400e3 }, limit: 3000 }).reduce((s, t) => s + t.notional, 0);
    const failedOps = store.all('operator_actions', { limit: 500 }).filter((a) => String(a.result).startsWith('FAIL')).length;

    res.json({
      health: system.health(markets),
      live: {
        openOrders: openOrders.length,
        manualReviews: reviews.length,
        pendingWithdrawals: pendingWd.length,
        riskAlerts: riskStats.openTotal,
        criticalRisk: riskStats.criticalOpen,
        failedOperations: failedOps,
        volume24hUsdtMinor: Math.round(volume * 100),
        pendingApprovals: approvals.length,
      },
      attentionQueue: queue.slice(0, 12),
      systemControls: system.current().values,
      recentAudit: audit.query({ limit: 12 }),
      simulated: ctx.config.demoMode,
    });
  });

  // ---- order command center ---------------------------------------------
  r.get('/orders', async (req, res) => {
    res.json({ orders: await trading.listOperator(req.query), total: store.count('orders') });
  });

  r.get('/orders/:num', async (req, res) => {
    const num = String(req.params.num).replace(/\D/g, '');
    const rows = await store.all('orders', { limit: 5000 });
    const o = rows.find((x) => String(x.num) === num) ?? store.get('orders', req.params.num);
    if (!o) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found.' } });
    const detail = await trading.withEvents(o.id);
    const u = store.get('users', o.user_id);
    res.json({ ...detail, user: u ? { id: u.id, email: u.email, name: u.name, role: u.role } : null });
  });

  r.post('/orders/:id/action', requirePerm('orders:ops:read'), async (req, res, next) => {
    try {
      const { action, reason } = req.body ?? {};
      if (!ORDER_ACTIONS.includes(action)) throw Object.assign(new Error(`Unknown action ${action}`), { code: 'BAD_ACTION', status: 400 });
      const actionPerm = ORDER_ACTION_PERM[action];
      if (actionPerm && !can(req.user.role, actionPerm)) throw new PermissionError(req.user.role, actionPerm);
      if (['hold_for_review', 'reject_review', 'pause'].includes(action) && !String(reason ?? '').trim()) {
        throw Object.assign(new Error('A reason is required for this action.'), { code: 'REASON_REQUIRED', status: 422 });
      }
      const order = store.get('orders', req.params.id);
      if (!order) throw Object.assign(new Error('Order not found'), { code: 'NOT_FOUND', status: 404 });
      const out = await trading.operatorAction(req.params.id, action, { actor: req.user.id, role: req.user.role, reason: reason ?? null });
      res.json({ order: out });
    } catch (e) {
      next(e);
    }
  });

  // ---- withdrawals -------------------------------------------------------
  r.get('/withdrawals', (req, res) => {
    res.json({ withdrawals: wallets.listOperator(req.query) });
  });

  r.get('/withdrawals/:id', (req, res) => {
    const d = wallets.withUser(req.params.id);
    if (!d) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Withdrawal not found.' } });
    res.json(d);
  });

  const WD_ACTION_PERM = {
    approve: 'withdrawals:act:review',
    hold: 'withdrawals:act:hold',
    release: 'withdrawals:act:hold',
    reject: 'withdrawals:act:reject',
    request_verification: 'withdrawals:act:review',
    verify: 'withdrawals:act:review',
  };
  r.post('/withdrawals/:id/action', async (req, res, next) => {
    try {
      const { action, reason } = req.body ?? {};
      const actionPerm = WD_ACTION_PERM[action];
      if (actionPerm && !can(req.user.role, actionPerm)) throw new PermissionError(req.user.role, actionPerm);
      const wd = store.get('withdrawals', req.params.id);
      if (!wd) throw Object.assign(new Error('Withdrawal not found'), { code: 'NOT_FOUND', status: 404 });
      if (['hold', 'reject'].includes(action) && !String(reason ?? '').trim()) {
        throw Object.assign(new Error('A reason is required for this action.'), { code: 'REASON_REQUIRED', status: 422 });
      }
      const out = await wallets.operatorAction(req.params.id, action, { actor: req.user.id, role: req.user.role, reason: reason ?? null });
      res.json({ withdrawal: out });
    } catch (e) {
      next(e);
    }
  });

  // ---- risk --------------------------------------------------------------
  r.get('/risk/events', (req, res) => res.json({ events: risk.query(req.query) }));
  r.get('/risk/rules', (req, res) => res.json({ rules: risk.rules() }));
  r.get('/risk/stats', async (req, res) => res.json(await risk.stats()));
  r.post('/risk/events/:id/resolve', requirePerm('risk:resolve'), async (req, res, next) => {
    try {
      const ev = await risk.resolve(req.params.id, req.user.id, req.user.role, req.body?.note ?? null);
      if (!ev) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found.' } });
      await audit.record({ actor: req.user.id, role: req.user.role, action: 'risk.resolve', targetType: 'risk_event', targetId: req.params.id, oldState: 'OPEN', newState: 'RESOLVED', reason: req.body?.note ?? null });
      res.json({ event: ev });
    } catch (e) {
      next(e);
    }
  });

  // ---- users -------------------------------------------------------------
  r.get('/users', (req, res) => res.json({ users: users.searchOperator(req.query.q ?? '', 50) }));
  r.get('/users/:id', (req, res) => {
    const d = users.operatorDetail(req.params.id);
    if (!d) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    res.json(d);
  });
  r.get('/timeline', (req, res) => {
    const { entity, id } = req.query;
    if (!entity || !id) return res.status(400).json({ error: { code: 'BAD_PARAMS', message: 'entity and id required.' } });
    res.json({ timeline: users.timeline(String(entity), String(id)) });
  });

  // ---- markets controls --------------------------------------------------
  r.get('/markets', (req, res) => {
    const summaries = markets.allSummaries();
    const controls = marketOps.list();
    res.json({ markets: summaries.map((s) => ({ ...s, control: controls.find((c) => c.pair === s.pair) })) });
  });

  const normPair = (p) => String(p ?? '').replace(/-/g, '/');
  r.post('/markets/:pair/control', requirePerm('markets:ops:act'), async (req, res, next) => {
    try {
      const { state, reason } = req.body ?? {};
      const pair = normPair(req.params.pair);
      if (!markets.markets.has(pair)) throw Object.assign(new Error(`Unknown market ${pair}`), { code: 'NOT_FOUND', status: 404 });
      if (['PAUSED', 'TRADING', 'MAINTENANCE'].includes(state)) {
        const row = await marketOps.setMarketState(pair, state, { actor: req.user.id, role: req.user.role, reason: reason ?? null });
        res.json({ control: row, immediate: true });
        return;
      }
      res.status(400).json({ error: { code: 'BAD_STATE', message: 'state must be PAUSED | TRADING | MAINTENANCE' } });
    } catch (e) {
      next(e);
    }
  });

  r.post('/markets/:pair/request-control', requirePerm('markets:ops:act'), (req, res) => {
    try {
      const { state, reason } = req.body ?? {};
      const pair = normPair(req.params.pair);
      if (!markets.markets.has(pair)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: `Unknown market ${pair}` } });
      const approval = marketOps.requestMarketState(pair, state, { actor: req.user.id, role: req.user.role, reason });
      res.json({ approval });
    } catch (e) {
      res.status(400).json({ error: { code: e.code ?? 'ERROR', message: e.message } });
    }
  });

  // ---- system & emergency controls --------------------------------------
  r.get('/system', (req, res) => {
    res.json({ controls: system.current(), health: system.health(markets) });
  });

  r.post('/system/control', requirePerm('system:act:single'), async (req, res, next) => {
    try {
      const { key, value, reason } = req.body ?? {};
      const out = await system.setControl(key, value, { actor: req.user.id, role: req.user.role, reason: reason ?? null });
      res.json({ controls: out });
    } catch (e) {
      next(e);
    }
  });

  r.post('/system/request-control', requirePerm('system:act:single'), (req, res) => {
    try {
      const { key, value, reason } = req.body ?? {};
      const approval = system.requestControl(key, value, { actor: req.user.id, role: req.user.role, reason });
      res.json({ approval });
    } catch (e) {
      res.status(400).json({ error: { code: e.code ?? 'ERROR', message: e.message } });
    }
  });

  // ---- balance adjustments ----------------------------------------------
  r.get('/adjustments', (req, res) => res.json({ adjustments: adjustments.list(req.query) }));

  r.post('/adjustments', requirePerm('adjustments:create'), async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const adj = await adjustments.create(req.user, {
        targetUserId: b.targetUserId, asset: b.asset,
        amountMinor: b.amountMinor ?? b.amount,
        reason: b.reason, reference: b.reference, evidence: b.evidence,
      });
      res.status(201).json({ adjustment: adj });
    } catch (e) {
      next(e);
    }
  });

  r.post('/adjustments/:id/approve', requirePerm('adjustments:create'), async (req, res, next) => {
    try {
      const out = await adjustments.approve(req.user, req.params.id, { reason: req.body?.reason ?? null });
      res.json({ adjustment: out });
    } catch (e) {
      next(e);
    }
  });

  r.post('/adjustments/:id/reject', requirePerm('adjustments:create'), async (req, res, next) => {
    try {
      const out = await adjustments.reject(req.user, req.params.id, { reason: req.body?.reason ?? null });
      res.json({ adjustment: out });
    } catch (e) {
      next(e);
    }
  });

  // ---- audit -------------------------------------------------------------
  r.get('/audit', requirePerm('audit:read'), (req, res) => res.json({ events: audit.query(req.query) }));

  return r;
}
