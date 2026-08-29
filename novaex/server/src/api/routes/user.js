import { Router } from 'express';
import { toMinor, toHuman } from '../../../../shared/money.js';

export function userRoutes(ctx) {
  const { store, users, trading, wallets, markets, config } = ctx;
  const r = Router();

  // /api/v1/users
  r.get('/users/me', (req, res) => {
    const u = store.get('users', req.user.id);
    res.json({ user: req.app.locals.auth.safeUser(u) });
  });

  // /api/v1/portfolio
  r.get('/portfolio', (req, res) => {
    res.json(users.portfolio(req.user));
  });

  // /api/v1/markets
  r.get('/markets', (req, res) => {
    res.json({ markets: markets.allSummaries(), simulated: config.demoMode });
  });

  r.get('/markets/:pair', (req, res) => {
    const pair = req.params.pair;
    const s = markets.summary(pair);
    if (!s) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Market not found.' } });
    const control = store.all('market_controls', { eq: { pair }, limit: 1 })[0];
    res.json({ market: s, state: control?.state ?? 'TRADING', controls: control ?? null });
  });

  r.get('/markets/:pair/candles', (req, res) => {
    const tf = String(req.query.tf ?? '1m');
    const count = Math.min(Number(req.query.count ?? 180), 800);
    const rows = markets.candles(req.params.pair, tf, count);
    if (!rows) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Market not found.' } });
    res.json({ pair: req.params.pair, tf, candles: rows });
  });

  r.get('/markets/:pair/book', (req, res) => {
    const state = markets.markets.get(req.params.pair);
    if (!state) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Market not found.' } });
    const best = markets.best(state);
    res.json({ bids: state.book.bids, asks: state.book.asks, spread: best.spread, mid: best.mid, spreadPct: best.spreadPct });
  });

  r.get('/markets/:pair/trades', (req, res) => {
    const state = markets.markets.get(req.params.pair);
    if (!state) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Market not found.' } });
    res.json({ trades: state.trades.slice(-60).reverse() });
  });

  // /api/v1/orders (own orders)
  r.post('/orders', async (req, res, next) => {
    try {
      const b = req.body ?? {};
      // client sends human decimal strings; server converts to minor units
      const TYPE_ALIAS = { MARKET: 'MARKET', LIMIT: 'LIMIT', STOP: 'STOP', STOP_MARKET: 'STOP', STOPLOSS: 'STOP' };
      const type = TYPE_ALIAS[String(b.type ?? 'MARKET').toUpperCase()];
      if (!type) throw new Object.assign(new Error('Invalid order type'), { code: 'BAD_TYPE', status: 400 });
      const input = {
        pair: b.pair,
        side: String(b.side ?? '').toUpperCase(),
        type,
        price: b.price != null ? String(b.price) : null,
        stopPrice: b.stopPrice != null ? String(b.stopPrice) : null,
        baseAmount: b.baseAmount != null ? String(b.baseAmount) : null,
        quoteAmount: b.quoteAmount != null ? toMinor('USDT', String(b.quoteAmount)) : null,
      };
      if (b.swap === true) input.swap = true;
      const out = await trading.createOrder(req.user, input);
      if (out.rejected) {
        res.status(422).json({ order: out.order, error: { code: out.rejected, message: out.rejected === 'INSUFFICIENT_FUNDS' ? 'Insufficient available balance.' : 'Order rejected.' } });
        return;
      }
      res.status(201).json({ order: out.order, review: !!out.review });
    } catch (e) {
      next(e);
    }
  });

  // /api/v1/swaps — instant market conversion (recorded as SWAP transactions)
  r.post('/swaps', async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const input = {
        pair: b.pair,
        side: String(b.side ?? (b.quoteAmount != null ? 'BUY' : 'SELL')).toUpperCase(),
        type: 'MARKET',
        swap: true,
        baseAmount: b.baseAmount != null ? String(b.baseAmount) : null,
        quoteAmount: b.quoteAmount != null ? toMinor('USDT', String(b.quoteAmount)) : null,
      };
      const out = await trading.createOrder(req.user, input);
      if (out.rejected) {
        res.status(422).json({ order: out.order, error: { code: out.rejected, message: 'Swap rejected.' } });
        return;
      }
      res.status(201).json({ order: out.order });
    } catch (e) {
      next(e);
    }
  });

  r.get('/orders', (req, res) => {
    res.json({ orders: trading.listForUser(req.user, req.query) });
  });

  r.get('/orders/:id', async (req, res) => {
    const o = store.get('orders', req.params.id);
    if (!o) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found.' } });
    if (o.user_id !== req.user.id && !['operator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your order.' } });
    }
    const detail = await trading.withEvents(o.id);
    res.json(detail);
  });

  r.post('/orders/:id/cancel', async (req, res, next) => {
    try {
      const o = await trading.cancelOrder(req.user, req.params.id, { reason: req.body?.reason ?? 'User cancel' });
      res.json({ order: o });
    } catch (e) {
      next(e);
    }
  });

  // /api/v1/trades (own trade history)
  r.get('/trades', (req, res) => {
    const rows = store.all('trades', { eq: { user_id: req.user.id }, order: 'ts', dir: 'desc', limit: Math.min(Number(req.query.limit ?? 100), 500) });
    res.json({ trades: rows });
  });

  // /api/v1/wallets
  r.get('/wallets', async (req, res) => {
    await wallets.ensureWallets(req.user);
    const balances = wallets.balances(req.user).map((b) => {
      const st = b.asset === 'USDT' ? null : markets.markets.get(`${b.asset}/USDT`);
      const qty = b.available + b.reserved;
      const valueUsd = b.asset === 'USDT' ? qty : st ? (qty * st.last) / 1e8 : null;
      return { ...b, qtyMinor: qty, qty: toHuman(b.asset, qty), valueUsdMinor: valueUsd != null ? Math.round(valueUsd * 100) : null };
    });
    res.json({ balances, wallets: wallets.list(req.user) });
  });

  r.post('/wallets/deposit', async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const dep = await wallets.requestDeposit(req.user, {
        asset: b.asset, network: b.network,
        amountMinor: b.amount != null ? toMinor(b.asset, String(b.amount)) : null,
        idem: req.headers['idempotency-key'] ?? b.idem,
      });
      res.status(201).json({ deposit: dep });
    } catch (e) {
      next(e);
    }
  });

  r.post('/wallets/withdraw', async (req, res, next) => {
    try {
      const b = req.body ?? {};
      const wd = await wallets.requestWithdrawal(req.user, {
        asset: b.asset, network: b.network, address: b.address,
        amountMinor: b.amount != null ? toMinor(b.asset, String(b.amount)) : null,
        idem: req.headers['idempotency-key'] ?? b.idem,
      });
      res.status(201).json({ withdrawal: wd });
    } catch (e) {
      next(e);
    }
  });

  r.get('/wallets/deposits', (req, res) => {
    res.json({ deposits: store.all('deposits', { eq: { user_id: req.user.id }, order: 'ts', dir: 'desc', limit: 50 }) });
  });

  r.get('/wallets/withdrawals', (req, res) => {
    res.json({ withdrawals: store.all('withdrawals', { eq: { user_id: req.user.id }, order: 'ts', dir: 'desc', limit: 50 }) });
  });

  // /api/v1/transactions (own)
  r.get('/transactions', (req, res) => {
    res.json({ transactions: users.activity(req.user, { kind: req.query.kind ?? null, limit: req.query.limit ?? 50 }) });
  });

  // /api/v1/notifications
  r.get('/notifications', async (req, res) => {
    const { NotificationService } = await import('../../services/notifications.js');
    const n = req.app.locals.notifications;
    res.json({ notifications: await n.list(req.user.id, { limit: 30 }), unread: await n.unreadCount(req.user.id) });
  });
  r.post('/notifications/:id/read', async (req, res) => {
    const n = req.app.locals.notifications;
    await n.markRead(req.user.id, req.params.id);
    res.json({ ok: true });
  });

  // /api/v1/search
  r.get('/search', (req, res) => {
    res.json(req.app.locals.search.search(req.user, req.query.q ?? ''));
  });

  return r;
}
