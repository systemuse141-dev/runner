// Order + execution service. Owns the order state machine, reservations,
// fills and operator interventions. All financial writes go through the
// double-entry ledger; executed trades are never rewritten.

import {
  ORDER_STATES, ORDER_TYPES, ORDER_SIDES, ORDER_ACTIONS, ASSETS,
} from '../../../shared/contracts.js';
import { toMinor, toHuman, fmtMoney, decimals, add } from '../../../shared/money.js';
import { assertTransition, canTransition, isTerminal, cancellableFrom } from '../domain/orderStateMachine.js';
import { FeeEngine, requiredReserve } from '../domain/fees.js';
import * as ledger from '../domain/ledger.js';
import { assessRisk } from '../domain/risk.js';
import { assertCan } from '../domain/rbac.js';

export class OrderError extends Error {
  constructor(msg, code = 'ORDER_ERROR') {
    super(msg);
    this.name = 'OrderError';
    this.code = code;
    const MAP = { FORBIDDEN: 403, NOT_FOUND: 404, BAD_STATE: 409, ILLEGAL_STATE_TRANSITION: 409 };
    this.status = MAP[code] ?? 400;
  }
}

export class TradingService {
  constructor(ctx) {
    this.store = ctx.store;
    this.audit = ctx.audit;
    this.notify = ctx.notify;
    this.markets = ctx.markets;
    this.risk = ctx.risk;
    this.config = ctx.config;
    this.fees = new FeeEngine();
  }

  async pairInfo(pair) {
    const [base, quote] = pair.split('/');
    if (!ASSETS[base] || !ASSETS[quote]) throw new OrderError(`Unknown pair ${pair}`, 'BAD_PAIR');
    const marketControl = await this.store.all('market_controls', { eq: { pair }, limit: 1 });
    const state = marketControl[0]?.state ?? 'TRADING';
    return { base, quote, state };
  }

  async checkTradingAllowed(side, pair) {
    const sys = await this.store.all('system_controls', { limit: 50 });
    const get = (k, def) => sys.find((s) => s.key === k)?.value ?? def;
    if (get('maintenance', 'false') === 'true') throw new OrderError('Exchange is in maintenance mode', 'MAINTENANCE');
    if (get('trading', 'LIVE') === 'PAUSED') throw new OrderError('Trading is paused by operations', 'TRADING_PAUSED');
    if (side === 'BUY' && get('buy', 'LIVE') === 'PAUSED') throw new OrderError('Buying is paused by operations', 'BUY_PAUSED');
    if (side === 'SELL' && get('sell', 'LIVE') === 'PAUSED') throw new OrderError('Selling is paused by operations', 'SELL_PAUSED');
    const { state } = await this.pairInfo(pair);
    if (state !== 'TRADING') throw new OrderError(`Market ${pair} is ${state.toLowerCase()}`, 'MARKET_NOT_TRADING');
  }

  async userBalances(userId) {
    const rows = await this.store.all('balances', { eq: { user_id: userId } });
    const out = {};
    for (const r of rows) out[r.asset] = { available: r.available, reserved: r.reserved };
    return out;
  }

  async volume30dUsdt(userId) {
    const since = Date.now() - 30 * 86400e3;
    const rows = await this.store.all('trades', { eq: { user_id: userId }, gte: { ts: since }, limit: 2000 });
    return rows.reduce((s, t) => s + t.notional, 0);
  }

  async avgOrderNotionalUsdt(userId) {
    const since = Date.now() - 30 * 86400e3;
    const rows = await this.store.all('orders', { eq: { user_id: userId }, gte: { created_at: since }, limit: 2000 });
    const filled = rows.filter((o) => o.state === 'FILLED' || o.state === 'PARTIALLY_FILLED');
    const vals = filled.map((o) => o.quote_amount ?? 0).filter((v) => v > 0);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  /** Create an order (user-facing). */
  async createOrder(user, input) {
    const { pair, side, type } = input;
    if (!ORDER_TYPES.includes(type)) throw new OrderError(`Invalid type ${type}`, 'BAD_TYPE');
    if (!ORDER_SIDES.includes(side)) throw new OrderError(`Invalid side ${side}`, 'BAD_SIDE');
    if (type !== 'MARKET') assertCan(user.role, 'orders:create:limit');
    await this.checkTradingAllowed(side, pair);
    const { base, quote } = await this.pairInfo(pair);

    const summary = this.markets.summary(pair);
    if (!summary) throw new OrderError(`Market ${pair} unavailable`, 'NO_MARKET');
    const best = this.markets.best(this.markets.markets.get(pair));

    let price = null, stopPrice = null, qty = 0, notional = 0, fee = 0, feeSide = 'maker', reserveAsset = quote, reserveAmt = 0;

    if (type === 'MARKET') {
      if (side === 'BUY') {
        const quoteAmount = Number(input.quoteAmount ?? 0);
        if (quoteAmount <= 0) throw new OrderError('quoteAmount required for market buy', 'BAD_AMOUNT');
        price = best.ask;
        qty = Math.floor(quoteAmount / price) * 10 ** 0; // qty in base minor? see below
        qty = Math.floor((quoteAmount / price) * 10 ** decimals(base));
        notional = Math.round(qty * price / 10 ** decimals(base));
        feeSide = 'taker';
      } else {
        qty = toMinor(base, input.baseAmount ?? '0');
        if (qty <= 0) throw new OrderError('baseAmount required for market sell', 'BAD_AMOUNT');
        price = best.bid;
        notional = Math.round(qty * price / 10 ** decimals(base));
        feeSide = 'taker';
        reserveAsset = base;
      }
    } else if (type === 'LIMIT') {
      price = toMinor(quote, input.price ?? '0');
      if (price <= 0) throw new OrderError('price required for limit order', 'BAD_PRICE');
      qty = toMinor(base, input.baseAmount ?? '0');
      if (qty <= 0) throw new OrderError('baseAmount required', 'BAD_AMOUNT');
      notional = Math.round(qty * price / 10 ** decimals(base));
      if (side === 'SELL') reserveAsset = base;
    } else {
      stopPrice = toMinor(quote, input.stopPrice ?? '0');
      if (stopPrice <= 0) throw new OrderError('stopPrice required', 'BAD_PRICE');
      qty = toMinor(base, input.baseAmount ?? '0');
      if (qty <= 0) throw new OrderError('baseAmount required', 'BAD_AMOUNT');
      notional = Math.round(qty * stopPrice / 10 ** decimals(base));
      feeSide = 'taker';
      if (side === 'SELL') reserveAsset = base;
    }

    const minNotional = await this.store.metaGet('min_notional_usdt', 10);
    if (notional < toMinor('USDT', String(minNotional))) {
      throw new OrderError(`Order notional below minimum (${minNotional} USDT)`, 'MIN_NOTIONAL');
    }

    const vol = await this.volume30dUsdt(user.id);
    const feeCalc = this.fees.compute(notional, feeSide, vol);
    fee = feeCalc.feeMinor;

    // reservation amount
    if (side === 'BUY') reserveAmt = requiredReserve(notional, fee);
    else reserveAmt = type === 'MARKET' ? qty : qty; // sells reserve base qty; fee comes from proceeds

    const riskCtx = {
      orderNotionalUsdt: notional / 100,
      avgOrderNotionalUsdt: (await this.avgOrderNotionalUsdt(user.id)) ? (await this.avgOrderNotionalUsdt(user.id)) / 100 : null,
    };
    const riskRes = assessRisk(riskCtx);

    const order = await this.store.insert('orders', {
      id: crypto.randomUUID(),
      num: await this.store.nextSeq('order_num'),
      user_id: user.id,
      pair, base, quote, side, type,
      state: 'CREATED',
      price, stop_price: stopPrice,
      qty, quote_amount: notional,
      filled: 0, quote_filled: 0,
      avg_price: null,
      fee: 0, fee_asset: quote,
      risk_level: riskRes.level,
      risk_events: [],
      amendment_requested: false,
      swap: input.swap === true,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    await this._transition(order, 'VALIDATING', 'system', 'Validation started');

    // balance check + reservation for resting/stop orders; market orders settle instantly
    let rejected = null;
    if (type === 'MARKET') {
      const bal = (await this.userBalances(user.id))[side === 'BUY' ? quote : base] ?? { available: 0 };
      const needed = side === 'BUY' ? notional + fee : qty;
      if (bal.available < needed) rejected = 'INSUFFICIENT_FUNDS';
    } else {
      const bal = (await this.userBalances(user.id))[reserveAsset] ?? { available: 0 };
      if (reserveAsset === quote && bal.available < reserveAmt) rejected = 'INSUFFICIENT_FUNDS';
      if (reserveAsset === base && bal.available < qty) rejected = 'INSUFFICIENT_FUNDS';
    }

    if (rejected) {
      await this._transition(order, 'REJECTED', 'system', rejected);
      const o = await this.store.get('orders', order.id);
      return { order: o, rejected: rejected };
    }

    if (riskRes.level === 'HIGH' || riskRes.level === 'CRITICAL') {
      // route to manual review with funds reserved (limit/stop) or held (market)
      await this._reserve(order, reserveAsset, reserveAmt);
      const riskEvent = await this.risk.record({
        type: 'order', entityType: 'order', entityId: order.id, userId: user.id,
        ctx: riskCtx, extra: { notional: notional },
      });
      const o1 = await this.store.get('orders', order.id);
      await this.store.update('orders', order.id, { risk_events: [...(o1.risk_events ?? []), riskEvent.id] });
      await this._transition(order, 'MANUAL_REVIEW', 'system', `Risk ${riskRes.level}: ${riskRes.rules.map((r) => r.id).join(', ')}`);
      await this.store.insert('manual_reviews', {
        id: crypto.randomUUID(), kind: 'order', entity_id: order.id,
        level: riskRes.level, reason: `Order size anomaly — ${riskRes.rules[0]?.detail ?? ''}`,
        status: 'OPEN', assigned_to: null, ts: Date.now(),
      });
      await this.notify.send(user.id, { kind: 'order_review', title: 'Order requires review', body: `Order ${order.num} (${pair} ${side}) was held for manual review due to risk controls.` });
      const o = await this.store.get('orders', order.id);
      return { order: o, review: true };
    }

    await this._reserve(order, reserveAsset, reserveAmt);
    await this._transition(order, 'OPEN', 'system', 'Validated and opened');

    if (type === 'MARKET') {
      await this._fillMarket(order);
    }
    const o = await this.store.get('orders', order.id);
    return { order: o };
  }

  async _reserve(order, asset, amount) {
    if (amount <= 0) return;
    await ledger.ops.reserveForOrder(this.store, {
      uid: order.user_id, asset, amount,
      idem: `order-reserve:${order.id}`, ref: order.id,
    });
  }

  async _transition(order, to, actor, reason, meta = null) {
    const cur = (await this.store.get('orders', order.id)) ?? order;
    assertTransition(cur.state, to);
    await this.store.update('orders', order.id, { state: to, updated_at: Date.now() });
    const ev = await this.store.insert('order_events', {
      id: crypto.randomUUID(), order_id: order.id,
      from_state: cur.state, to_state: to,
      actor, actor_role: actor === 'system' ? 'system' : 'user',
      reason, meta, ts: Date.now(),
    });
    this.markets?.busPush?.(order.user_id, { type: 'order', data: { order_id: order.id, state: to, ts: Date.now() } });
    return ev;
  }

  async _fillMarket(order) {
    const o = await this.store.get('orders', order.id);
    const { base, quote } = o;
    const state = this.markets.markets.get(o.pair);
    const best = this.markets.best(state);
    const price = o.side === 'BUY' ? best.ask : best.bid;
    const qty = o.qty; // fill the exact ordered qty at the execution price
    const notional = Math.round((qty * price) / 10 ** decimals(base));
    const vol = await this.volume30dUsdt(o.user_id);
    const fee = this.fees.compute(notional, 'taker', vol).feeMinor;

    // market buys reserved notional+fee at creation price; settle at execution price
    if (o.side === 'BUY') {
      const reserved = o.quote_amount + this.fees.compute(o.quote_amount, 'taker', vol).feeMinor;
      await ledger.ops.unreserve(this.store, { uid: o.user_id, asset: quote, amount: reserved, idem: `order-mkt-pre:${o.id}`, ref: o.id });
      await ledger.ops.marketFill(this.store, {
        uid: o.user_id, base, quote, qty, notional, fee, side: 'BUY',
        idem: `order-mkt-fill:${o.id}`, ref: o.id,
      });
    } else {
      await ledger.ops.unreserve(this.store, { uid: o.user_id, asset: base, amount: o.qty, idem: `order-mkt-pre:${o.id}`, ref: o.id });
      await ledger.ops.marketFill(this.store, {
        uid: o.user_id, base, quote, qty, notional, fee, side: 'SELL',
        idem: `order-mkt-fill:${o.id}`, ref: o.id,
      });
    }

    await this._recordFill(o, price, qty, notional, fee, 'taker');
    await this.store.update('orders', o.id, {
      state: 'FILLED', filled: o.qty, quote_filled: notional, avg_price: price,
      fee, quote_amount: notional, updated_at: Date.now(),
    });
    await this._event(o.id, 'OPEN', 'FILLED', 'system', `Filled at ${toHuman(quote, price)}`, { qty, notional, fee });
    await this.notify.send(o.user_id, { kind: 'trade', title: 'Order filled', body: `Order ${o.num} filled: ${toHuman(base, qty)} at ${toHuman(quote, price)}.` });
  }

  async _recordFill(o, price, qty, notional, fee, makerTaker) {
    await this.store.insert('order_fills', {
      id: crypto.randomUUID(), order_id: o.id, price, qty, fee,
      side: o.side, maker_taker: makerTaker, ts: Date.now(),
    });
    await this.store.insert('trades', {
      id: crypto.randomUUID(), user_id: o.user_id, order_id: o.id, pair: o.pair,
      side: o.side, price, qty, notional, fee, fee_asset: o.quote,
      maker_taker: makerTaker, ts: Date.now(),
    });
    await this.store.insert('transactions', {
      id: crypto.randomUUID(), user_id: o.user_id, kind: o.swap ? 'SWAP' : 'TRADE',
      ref_type: 'order', ref_id: o.id, asset: o.base, amount: qty,
      status: 'COMPLETED',
      meta: { pair: o.pair, price, notional, fee, side: o.side },
      ts: Date.now(),
    });
  }

  /** Limit/stop order processing on each market tick. */
  async onTick({ updates }) {
    for (const u of updates) {
      const pair = u.pair;
      const open = await this.store.all('orders', { eq: { pair, state: 'OPEN' }, limit: 500 });
      for (const o of open) {
        try {
          if (o.type === 'LIMIT') await this._tryLimitFill(o, u.price);
          else if (o.type === 'STOP') await this._tryStopTrigger(o, u.price);
        } catch (e) {
          console.error(`[trading] fill error on ${o.num}`, e.message);
        }
      }
    }
  }

  async _tryLimitFill(o, lastPrice) {
    const hit = o.side === 'BUY' ? lastPrice <= o.price : lastPrice >= o.price;
    if (!hit) return;
    const remaining = o.qty - o.filled;
    if (remaining <= 0) return;
    // partial fills: take a slice of the remainder
    const fillQty = Math.max(1, Math.floor(remaining * (0.35 + Math.random() * 0.5)));
    const dBase = decimals(o.base);
    const notional = Math.round((fillQty * o.price) / 10 ** dBase);
    const vol = await this.volume30dUsdt(o.user_id);
    const fee = this.fees.compute(notional, 'maker', vol).feeMinor;

    if (o.side === 'BUY') {
      await ledger.ops.makerFill(this.store, {
        uid: o.user_id, base: o.base, quote: o.quote,
        notional, qty: fillQty, fee, side: 'BUY',
        idem: `limit-fill:${o.id}:${o.filled + fillQty}`, ref: o.id,
      });
    } else {
      await ledger.ops.makerFill(this.store, {
        uid: o.user_id, base: o.base, quote: o.quote,
        notional, qty: fillQty, fee, side: 'SELL',
        idem: `limit-fill:${o.id}:${o.filled + fillQty}`, ref: o.id,
      });
    }

    const newFilled = o.filled + fillQty;
    const newQuote = (o.quote_filled ?? 0) + notional;
    const done = newFilled >= o.qty;
    await this._recordFill(o, o.price, fillQty, notional, fee, 'maker');
    await this.store.update('orders', o.id, {
      state: done ? 'FILLED' : 'PARTIALLY_FILLED',
      filled: newFilled, quote_filled: newQuote,
      avg_price: o.avg_price ?? o.price,
      fee: (o.fee ?? 0) + fee,
      updated_at: Date.now(),
    });
    await this._event(o.id, o.state, done ? 'FILLED' : 'PARTIALLY_FILLED', 'system', `Filled ${toHuman(o.base, fillQty)} @ ${toHuman(o.quote, o.price)}`, { fillQty, notional, fee });
    await this.notify.send(o.user_id, { kind: 'trade', title: done ? 'Limit order filled' : 'Limit order partially filled', body: `Order ${o.num}: ${toHuman(o.base, fillQty)} filled at ${toHuman(o.quote, o.price)}.` });
  }

  async _tryStopTrigger(o, lastPrice) {
    const hit = o.side === 'BUY' ? lastPrice >= o.stop_price : lastPrice <= o.stop_price;
    if (!hit) return;
    await this._event(o.id, o.state, o.state, 'system', `Stop triggered at ${toHuman(o.quote, lastPrice)}`, { trigger: o.stop_price });
    await this.store.update('orders', o.id, { type: 'MARKET', updated_at: Date.now() });
    await this._fillMarket(await this.store.get('orders', o.id));
  }

  async _event(orderId, from, to, actor, reason, meta) {
    await this.store.insert('order_events', {
      id: crypto.randomUUID(), order_id: orderId, from_state: from, to_state: to,
      actor, actor_role: actor === 'system' ? 'system' : 'user', reason, meta, ts: Date.now(),
    });
  }

  /** User cancel of own order. */
  async cancelOrder(user, orderId, { reason = 'User cancel', actorOverride = null } = {}) {
    const o = await this.store.get('orders', orderId);
    if (!o) throw new OrderError('Order not found', 'NOT_FOUND');
    if (actorOverride == null && o.user_id !== user.id) throw new OrderError('Not your order', 'FORBIDDEN');
    if (!cancellableFrom(o.state)) throw new OrderError(`Cannot cancel from state ${o.state}`, 'BAD_STATE');

    await this._transition(o, 'CANCEL_REQUESTED', actorOverride ?? user.id, reason);
    const cur = await this.store.get('orders', orderId);
    // release remaining reservation (incl. the fee portion reserved)
    const release = await this._releaseRemaining(cur);
    if (release > 0) {
      const reserveAsset = cur.side === 'SELL' && cur.type !== 'MARKET' ? cur.base : cur.quote;
      try {
        await ledger.ops.unreserve(this.store, { uid: cur.user_id, asset: reserveAsset, amount: release, idem: `cancel-release:${cur.id}`, ref: cur.id });
      } catch (e) {
        if (e.code !== 'INSUFFICIENT_FUNDS') throw e;
      }
    }
    await this._transition(cur, 'CANCELLED', actorOverride ?? user.id, 'Cancel confirmed');
    await this._resolveReview('order', orderId);
    return this.store.get('orders', orderId);
  }

  /** Operator actions — policy-controlled, validated, audited. */
  async operatorAction(orderId, action, { actor, role, reason, approvalId = null }) {
    const o = await this.store.get('orders', orderId);
    if (!o) throw new OrderError('Order not found', 'NOT_FOUND');
    if (!ORDER_ACTIONS.includes(action)) throw new OrderError(`Unknown action ${action}`, 'BAD_ACTION');
    const permMap = {
      cancel: 'orders:act:cancel', pause: 'orders:act:pause', resume: 'orders:act:resume',
      request_amendment: 'orders:act:amend', hold_for_review: 'orders:act:hold',
      approve_review: 'orders:act:review', reject_review: 'orders:act:review',
    };
    assertCan(role, permMap[action]);
    const oldState = o.state;

    if (action === 'cancel') {
      const res = await this.cancelOrder(null, orderId, { reason, actorOverride: actor });
      await this.audit.operatorAction({ actor, role, action: 'order.cancel', entityType: 'order', entityId: orderId, reason, result: 'OK', oldState, newState: 'CANCELLED', approvalId });
      return res;
    }
    if (action === 'pause' || action === 'hold_for_review') {
      assertTransition(o.state, 'MANUAL_REVIEW');
      await this._transition(o, 'MANUAL_REVIEW', actor, reason);
      await this.store.insert('manual_reviews', { id: crypto.randomUUID(), kind: 'order', entity_id: orderId, level: 'MEDIUM', reason, status: 'OPEN', assigned_to: actor, ts: Date.now() });
      await this.audit.operatorAction({ actor, role, action: `order.${action}`, entityType: 'order', entityId: orderId, reason, result: 'OK', oldState, newState: 'MANUAL_REVIEW', approvalId });
      return this.store.get('orders', orderId);
    }
    if (action === 'resume' || action === 'approve_review') {
      assertTransition(o.state, 'OPEN');
      await this._transition(o, 'OPEN', actor, reason);
      await this._resolveReview('order', orderId);
      await this.audit.operatorAction({ actor, role, action: `order.${action}`, entityType: 'order', entityId: orderId, reason, result: 'OK', oldState, newState: 'OPEN', approvalId });
      return this.store.get('orders', orderId);
    }
    if (action === 'reject_review') {
      assertTransition(o.state, 'CANCELLED');
      const release = await this._releaseRemaining(o);
      if (release > 0) {
        try {
          const asset = o.side === 'SELL' && o.type !== 'MARKET' ? o.base : o.quote;
          await ledger.ops.unreserve(this.store, { uid: o.user_id, asset, amount: release, idem: `reject-release:${o.id}`, ref: o.id });
        } catch { /* already released */ }
      }
      await this._transition(o, 'CANCELLED', actor, reason);
      await this._resolveReview('order', orderId);
      await this.audit.operatorAction({ actor, role, action: 'order.reject_review', entityType: 'order', entityId: orderId, reason, result: 'OK', oldState, newState: 'CANCELLED', approvalId });
      return this.store.get('orders', orderId);
    }
    if (action === 'request_amendment') {
      await this.store.update('orders', orderId, { amendment_requested: true, updated_at: Date.now() });
      await this._event(orderId, o.state, o.state, actor, `Amendment requested: ${reason ?? ''}`, { amendment: true });
      await this.notify.send(o.user_id, { kind: 'order_amendment', title: 'Amendment requested', body: `Operations requested an amendment on order ${o.num}: ${reason ?? 'see details'}.` });
      await this.audit.operatorAction({ actor, role, action: 'order.request_amendment', entityType: 'order', entityId: orderId, reason, result: 'OK', oldState, newState: o.state, approvalId });
      return this.store.get('orders', orderId);
    }
    throw new OrderError('Unreachable action', 'BAD_ACTION');
  }

  /** Remaining reservation for an unfilled order (notional + reserved fee). */
  async _releaseRemaining(o) {
    const remaining = o.qty - o.filled;
    if (remaining <= 0) return 0;
    const vol = await this.volume30dUsdt(o.user_id);
    if (o.side === 'SELL' && o.type !== 'MARKET') return remaining; // base qty reserved
    const dBase = decimals(o.base);
    if (o.type === 'MARKET') {
      const notional = o.quote_amount ?? 0;
      return notional + this.fees.compute(notional, 'taker', vol).feeMinor;
    }
    const price = o.price ?? 0;
    if (!price) return 0;
    const notionalRem = Math.round((remaining * price) / 10 ** dBase);
    const feeRem = this.fees.compute(notionalRem, 'maker', vol).feeMinor;
    return notionalRem + feeRem;
  }

  async _resolveReview(kind, entityId) {
    const open = await this.store.all('manual_reviews', { eq: { kind, entity_id: entityId, status: 'OPEN' } });
    for (const r of open) await this.store.update('manual_reviews', r.id, { status: 'RESOLVED', updated_at: Date.now() });
  }

  listForUser(user, filters = {}) {
    const opts = { order: 'created_at', dir: 'desc', limit: Math.min(Number(filters.limit ?? 50), 200) };
    const eq = { user_id: user.id };
    if (filters.state) eq.state = filters.state;
    if (filters.pair) eq.pair = filters.pair;
    opts.eq = eq;
    return this.store.all('orders', opts);
  }

  async listOperator(filters = {}) {
    const opts = { order: 'created_at', dir: 'desc', limit: Math.min(Number(filters.limit ?? 100), 500), offset: Number(filters.offset ?? 0) };
    const eq = {};
    if (filters.num) {
      const n = String(filters.num).replace(/\D/g, '');
      if (n) eq.num = Number(n);
    }
    if (filters.user) opts.custom = [(r) => (r.user_id === filters.user || (r.user_email ?? '').includes(filters.user))];
    if (filters.pair) eq.pair = filters.pair;
    if (filters.side) eq.side = filters.side;
    if (filters.type) eq.type = filters.type;
    if (filters.state) eq.state = filters.state;
    if (filters.risk) eq.risk_level = filters.risk;
    if (filters.from) opts.gte = { created_at: Number(filters.from) };
    if (filters.to) opts.lte = { created_at: Number(filters.to) };
    if (Object.keys(eq).length) opts.eq = eq;
    const rows = await this.store.all('orders', opts);
    const userMap = new Map();
    const users = await this.store.all('users', { limit: 500 });
    for (const u of users) userMap.set(u.id, u.email);
    for (const r of rows) r.user_email = userMap.get(r.user_id) ?? r.user_id;
    return rows;
  }

  async withEvents(orderId) {
    const o = await this.store.get('orders', orderId);
    if (!o) return null;
    const events = await this.store.all('order_events', { eq: { order_id: orderId }, order: 'ts', dir: 'asc', limit: 200 });
    const riskEvents = [];
    for (const rid of o.risk_events ?? []) {
      const r = await this.store.get('risk_events', rid);
      if (r) riskEvents.push(r);
    }
    return { order: o, events, riskEvents };
  }
}
