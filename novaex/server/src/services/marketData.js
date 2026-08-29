// Market data service. In DEMO_MODE this is the SimulatedMarketDataProvider:
// a deterministic random-walk feed with full candle history, order books and
// trades. The provider interface is identical for a real vendor adapter.

import { MARKET_PAIRS, ASSETS } from '../../../shared/contracts.js';
import { toMinor, toHuman, decimals } from '../../../shared/money.js';
import { mulberry32, gaussian } from '../domain/rng.js';

const MARKET_BASE = {
  'BTC/USDT': { price: 118240, vol: 0.00075, liquidity: 2.2, spreadBps: 2 },
  'ETH/USDT': { price: 4286, vol: 0.0011, liquidity: 9, spreadBps: 2.5 },
  'SOL/USDT': { price: 212.4, vol: 0.0016, liquidity: 60, spreadBps: 3 },
  'XRP/USDT': { price: 2.847, vol: 0.0014, liquidity: 9000, spreadBps: 4 },
  'ADA/USDT': { price: 1.124, vol: 0.0017, liquidity: 24000, spreadBps: 4 },
  'DOGE/USDT': { price: 0.2106, vol: 0.0023, liquidity: 140000, spreadBps: 5 },
  'AVAX/USDT': { price: 41.52, vol: 0.0016, liquidity: 1600, spreadBps: 3 },
  'LINK/USDT': { price: 22.38, vol: 0.0015, liquidity: 4200, spreadBps: 3 },
};

const MINUTE = 60_000;
const MAX_CANDLES = 5000;
const BOOK_LEVELS = 10;

export class MarketDataService {
  constructor(store, { demoMode = true } = {}) {
    this.store = store;
    this.demoMode = demoMode;
    this.markets = new Map(); // pair -> state
    this.portfolioSeries = new Map(); // uid -> [{ts,total}]
    this.onTick = null; // (store, ctx) => hook for trading fills
    this.onSpreadAnomaly = null; // (store, pair) => risk hook
    this._timer = null;
    this._rng = mulberry32(0xC0FFEE ^ Date.now());
    this.startedAt = Date.now();
  }

  async seed({ historyDays = 7 } = {}) {
    const now = Date.now();
    const stepMs = MINUTE;
    const total = historyDays * 24 * 60;
    for (const pair of MARKET_PAIRS) {
      const [base, quote] = pair.split('/');
      const cfg = MARKET_BASE[pair];
      const dQuote = decimals(quote);
      const dBase = decimals(base);
      const rng = mulberry32(pair.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));

      // random walk backwards-computed then reversed
      let price = cfg.price;
      const candles = [];
      // walk forward from (now - history) to now
      let ts = now - total * stepMs;
      ts = Math.floor(ts / stepMs) * stepMs;
      for (let i = 0; i < total; i++) {
        const ret = gaussian(rng) * cfg.vol * 2.2; // intraday seed vol
        const o = price;
        price = price * (1 + ret);
        const c = price;
        const hi = Math.max(o, c) * (1 + Math.abs(gaussian(rng)) * cfg.vol * 0.8);
        const lo = Math.min(o, c) * (1 - Math.abs(gaussian(rng)) * cfg.vol * 0.8);
        const v = Math.max(1, Math.round((0.4 + Math.abs(gaussian(rng))) * cfg.liquidity * (1 + 2 * Math.abs(ret) / cfg.vol)));
        candles.push({
          ts: ts + i * stepMs,
          o: Math.round(o * 10 ** dQuote),
          h: Math.round(hi * 10 ** dQuote),
          l: Math.round(lo * 10 ** dQuote),
          c: Math.round(c * 10 ** dQuote),
          v: v * 10 ** dBase,
        });
      }

      const last24 = candles.slice(-1440);
      const state = {
        pair,
        base,
        quote,
        last: candles[candles.length - 1].c,
        open24h: last24[0].o,
        high24h: Math.max(...last24.map((c) => c.h)),
        low24h: Math.min(...last24.map((c) => c.l)),
        volume24h: last24.reduce((s, c) => s + c.v, 0),
        prevClose: last24[0].o,
        candles: candles.slice(-MAX_CANDLES),
        trades: [],
        book: { bids: [], asks: [] },
        spreadBpsEMA: cfg.spreadBps,
        spreadAnomalyCooldown: 0,
        cfg,
      };
      this.markets.set(pair, state);
      this._rebuildBook(state);
      this.store.insert('markets', {
        id: pair,
        base,
        quote,
        min_notional: toMinor('USDT', '10'),
        tick_size: Math.max(1, Math.round(state.last * 1e-6)),
        state: 'TRADING',
        updated_at: now,
      });
    }
    // seed portfolio history for the demo users
    this._seedPortfolioHistory();
  }

  _seedPortfolioHistory() {
    const users = ['u_alice', 'u_dana'];
    const now = Date.now();
    for (const uid of users) {
      const rng = mulberry32(uid.length * 7919);
      const pts = [];
      const days = 30;
      let total = uid === 'u_alice' ? 128_000 : 62_000; // dollars at seed start
      for (let i = days * 24 * 12; i >= 0; i--) {
        // 5-minute steps across 30 days
        const ts = now - i * 5 * MINUTE;
        total = total * (1 + gaussian(rng) * 0.0012);
        pts.push({ ts, total: Math.round(total * 100) });
      }
      this.portfolioSeries.set(uid, pts);
    }
  }

  start({ intervalMs = 700 } = {}) {
    if (this._timer) return;
    const loop = async () => {
      try {
        await this.tickOnce();
      } catch (e) {
        console.error('[market] tick failed', e);
      }
    };
    this._timer = setInterval(loop, intervalMs);
    this._timer.unref?.();
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async tickOnce() {
    const now = Date.now();
    const updates = [];
    for (const state of this.markets.values()) {
      const st = this._tickMarket(state, now);
      if (st) updates.push(st);
    }
    // portfolio snapshots (cheap; every ~10 ticks is enough — here every tick)
    await this._snapshotPortfolios(now);
    if (this.onTick) await this.onTick({ now, updates });
    return updates;
  }

  _tickMarket(state, now) {
    const cfg = state.cfg;
    const ret = gaussian(this._rng) * cfg.vol * 0.55;
    const prev = state.last;
    // state.last is in quote MINOR units — keep it that way
    let next = Math.round(prev * (1 + ret));
    const dQuote = decimals(state.quote);
    if (next <= 0) next = prev;
    state.last = next;
    state.high24h = Math.max(state.high24h, next);
    state.low24h = Math.min(state.low24h, next);

    // candle update
    const minute = Math.floor(now / MINUTE) * MINUTE;
    const cur = state.candles[state.candles.length - 1];
    if (!cur || cur.ts !== minute) {
      state.candles.push({ ts: minute, o: prev, h: Math.max(prev, next), l: Math.min(prev, next), c: next, v: 0 });
      if (state.candles.length > MAX_CANDLES) state.candles.shift();
    } else {
      cur.h = Math.max(cur.h, next);
      cur.l = Math.min(cur.l, next);
      cur.c = next;
    }

    // trades
    const n = this._rng() < 0.55 ? 1 + Math.floor(this._rng() * 2) : 0;
    const newTrades = [];
    for (let i = 0; i < n; i++) {
      const taker = this._rng() < 0.5 ? 'BUY' : 'SELL';
      const price = Math.round(next * (1 + (taker === 'BUY' ? 1 : -1) * (cfg.spreadBps / 2 / 10000)));
      const qty = Math.max(1, Math.round((0.05 + Math.abs(gaussian(this._rng)) * 1.2) * cfg.liquidity * 0.4 * 10 ** decimals(state.base)));
      const t = { id: crypto.randomUUID(), price, qty, side: taker, ts: now, sim: true };
      state.trades.push(t);
      if (state.trades.length > 80) state.trades.shift();
      cur.v += qty;
      state.volume24h += qty;
      newTrades.push(t);
    }

    // book
    const spreadBps = cfg.spreadBps * (0.8 + this._rng() * 0.6);
    this._rebuildBook(state, spreadBps);
    state.spreadBpsEMA = state.spreadBpsEMA * 0.95 + spreadBps * 0.05;

    // spread anomaly (R7)
    if (state.spreadAnomalyCooldown && state.spreadAnomalyCooldown < now) {
      state.spreadAnomalyCooldown = 0;
    }
    if (this.onSpreadAnomaly && state.spreadAnomalyCooldown === 0 && state.spreadBpsEMA > 0 && spreadBps >= state.spreadBpsEMA * 4) {
      state.spreadAnomalyCooldown = now + 10 * 60_000;
      this.onSpreadAnomaly(state.pair, { spreadRatio: spreadBps / state.spreadBpsEMA });
    }

    // 24h window slide
    const cutoff = now - 24 * 3600e3;
    if (state.candles.length && state.candles[0].ts < cutoff - 2 * MINUTE) {
      let droppedV = 0;
      while (state.candles.length && state.candles[0].ts < cutoff) droppedV += state.candles.shift().v;
      state.volume24h = Math.max(0, state.volume24h - droppedV);
      const last24 = state.candles.slice(-1440);
      if (last24.length > 100) {
        state.high24h = Math.max(...last24.map((c) => c.h));
        state.low24h = Math.min(...last24.map((c) => c.l));
        state.open24h = last24[0].o;
        state.prevClose = last24[0].o;
      }
    }

    return {
      pair: state.pair,
      price: state.last,
      changePct: ((state.last - state.open24h) / state.open24h) * 100,
      high: state.high24h,
      low: state.low24h,
      volume: state.volume24h,
      book: { bids: state.book.bids.slice(0, 8), asks: state.book.asks.slice(0, 8) },
      trades: newTrades,
      ts: now,
    };
  }

  _rebuildBook(state, spreadBps = state.cfg.spreadBps) {
    const dQuote = decimals(state.quote);
    const dBase = decimals(state.base);
    const half = (spreadBps / 2 / 10000) * state.last;
    const step = Math.max(1, Math.round(state.last * 1e-5));
    const bids = [];
    const asks = [];
    for (let i = 0; i < BOOK_LEVELS; i++) {
      const bidP = Math.max(1, Math.round(state.last - half - i * step * (1 + this._rng())));
      const askP = Math.round(state.last + half + i * step * (1 + this._rng()));
      bids.push({ p: bidP, q: Math.max(1, Math.round((0.3 + this._rng() * 2.4) * state.cfg.liquidity * 10 ** dBase)) });
      asks.push({ p: askP, q: Math.max(1, Math.round((0.3 + this._rng() * 2.4) * state.cfg.liquidity * 10 ** dBase)) });
    }
    state.book = { bids, asks };
  }

  best(state) {
    const bid = state.book.bids[0]?.p ?? state.last;
    const ask = state.book.asks[0]?.p ?? state.last;
    return { bid, ask, mid: Math.round((bid + ask) / 2), spread: ask - bid, spreadPct: ((ask - bid) / state.last) * 100 };
  }

  async _snapshotPortfolios(now) {
    const balances = await this.store.all('balances', { limit: 500 });
    const byUser = new Map();
    for (const b of balances) {
      const usd = b.asset === 'USDT' ? b.available + b.reserved : this._toUsdt(b.asset, b.available + b.reserved);
      const cur = byUser.get(b.user_id) ?? {};
      cur[b.asset] = (cur[b.asset] ?? 0) + usd;
      byUser.set(b.user_id, cur);
    }
    for (const [uid, holdings] of byUser) {
      const total = Object.values(holdings).reduce((s, v) => s + v, 0);
      let series = this.portfolioSeries.get(uid);
      if (!series) {
        series = [];
        this.portfolioSeries.set(uid, series);
      }
      const lastPt = series[series.length - 1];
      if (!lastPt || now - lastPt.ts >= 15_000) {
        series.push({ ts: now, total: Math.round(total) }); // USDT minor units
        if (series.length > 4000) series.shift();
      }
    }
  }

  _toUsdt(asset, minor) {
    if (asset === 'USDT') return minor;
    const state = this.markets.get(`${asset}/USDT`);
    if (!state) return minor;
    // price minor (quote per 1 base unit) → value = qtyMinor * priceMinor / 10^baseDec
    return (minor * state.last) / 10 ** decimals(asset);
  }

  candles(pair, tf = '1m', count = 180) {
    const state = this.markets.get(pair);
    if (!state) return null;
    const tfMs = tf === '1m' ? MINUTE : tf === '5m' ? 5 * MINUTE : tf === '15m' ? 15 * MINUTE : tf === '1h' ? 3600e3 : tf === '4h' ? 4 * 3600e3 : 24 * 3600e3;
    const agg = tf === '1m' ? state.candles : this._aggregate(state.candles, tfMs);
    return agg.slice(-count);
  }

  _aggregate(candles, tfMs) {
    const out = [];
    let cur = null;
    for (const c of candles) {
      const b = Math.floor(c.ts / tfMs) * tfMs;
      if (!cur || cur.ts !== b) {
        cur = { ts: b, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v };
        out.push(cur);
      } else {
        cur.h = Math.max(cur.h, c.h);
        cur.l = Math.min(cur.l, c.l);
        cur.c = c.c;
        cur.v += c.v;
      }
    }
    return out;
  }

  summary(pair) {
    const state = this.markets.get(pair);
    if (!state) return null;
    const b = this.best(state);
    return {
      pair,
      last: state.last,
      open24h: state.open24h,
      high24h: state.high24h,
      low24h: state.low24h,
      changePct: ((state.last - state.open24h) / state.open24h) * 100,
      volume24h: state.volume24h,
      spread: b.spread,
      spreadPct: b.spreadPct,
      book: state.book,
      trades: state.trades.slice(-50).reverse(),
      simulated: this.demoMode,
    };
  }

  allSummaries() {
    return MARKET_PAIRS.map((p) => {
      const s = this.summary(p);
      return s && { pair: p, last: s.last, changePct: s.changePct, high24h: s.high24h, low24h: s.low24h, volume24h: s.volume24h, spreadPct: s.spreadPct, simulated: true };
    });
  }

  portfolio(uid, rangeMs = 24 * 3600e3) {
    const series = (this.portfolioSeries.get(uid) ?? []).filter((p) => p.ts >= Date.now() - rangeMs);
    return series;
  }
}
