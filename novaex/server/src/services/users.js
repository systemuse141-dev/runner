// User service: profiles, portfolios, activity, operator user views.

import { ASSETS } from '../../../shared/contracts.js';
import { toHuman, decimals } from '../../../shared/money.js';

export class UsersService {
  constructor(ctx) {
    this.store = ctx.store;
    this.markets = ctx.markets;
  }

  portfolio(user) {
    const balances = this.store.all('balances', { eq: { user_id: user.id } });
    const assets = [];
    let total = 0;
    let change24h = 0;
    for (const b of balances) {
      const qty = b.available + b.reserved;
      if (qty <= 0) continue;
      let valueUsdMinor;
      let changePct = 0;
      let priceMinor = null;
      if (b.asset === 'USDT') {
        valueUsdMinor = qty;
      } else {
        const st = this.markets.markets.get(`${b.asset}/USDT`);
        if (!st) continue;
        priceMinor = st.last;
        // qty (base minor) * price (quote minor per 1 base unit) / 1e8 = quote minor
        valueUsdMinor = (qty * st.last) / 10 ** decimals(b.asset);
        changePct = ((st.last - st.open24h) / st.open24h) * 100;
      }
      total += valueUsdMinor;
      change24h += valueUsdMinor * (changePct / 100);
      assets.push({
        asset: b.asset,
        name: ASSETS[b.asset]?.name ?? b.asset,
        qtyMinor: qty,
        qty: toHuman(b.asset, qty),
        availableMinor: b.available,
        reservedMinor: b.reserved,
        priceMinor,
        valueUsdMinor: Math.round(valueUsdMinor),
        changePct,
      });
    }
    assets.sort((a, b) => b.valueUsdMinor - a.valueUsdMinor);
    const series = this.markets.portfolio(user.id, 24 * 3600e3);
    return {
      totalUsdMinor: Math.round(total * 100),
      change24hUsdMinor: Math.round(change24h * 100),
      change24hPct: total > 0 ? (change24h / (total - change24h)) * 100 : 0,
      assets,
      series,
      simulated: this.markets.demoMode,
    };
  }

  activity(user, { kind = null, limit = 50 } = {}) {
    const opts = { order: 'ts', dir: 'desc', limit: Math.min(Number(limit ?? 50), 200) };
    const eq = { user_id: user.id };
    if (kind) eq.kind = kind;
    opts.eq = eq;
    return this.store.all('transactions', opts);
  }

  searchOperator(q, limit = 20) {
    const opts = { limit };
    if (q) {
      opts.custom = [
        (r) => r.email.toLowerCase().includes(q.toLowerCase()) || r.name.toLowerCase().includes(q.toLowerCase()),
      ];
    }
    return this.store.all('users', { ...opts, order: 'created_at', dir: 'desc' });
  }

  operatorDetail(userId) {
    const user = this.store.get('users', userId);
    if (!user) return null;
    const balances = this.store.all('balances', { eq: { user_id: userId } });
    const orders = this.store.all('orders', { eq: { user_id: userId }, order: 'created_at', dir: 'desc', limit: 20 });
    const withdrawals = this.store.all('withdrawals', { eq: { user_id: userId }, order: 'ts', dir: 'desc', limit: 20 });
    const security = this.store.all('security_events', { eq: { user_id: userId }, order: 'ts', dir: 'desc', limit: 20 });
    const risk = this.store.all('risk_events', { eq: { user_id: userId }, order: 'ts', dir: 'desc', limit: 20 });
    return { user, balances, orders, withdrawals, security, risk };
  }

  /** Unified operator timeline for an entity. */
  timeline(entityType, entityId) {
    const items = [];
    const push = (ts, kind, title, detail, actor = null) => items.push({ ts, kind, title, detail, actor });
    const now = Date.now();

    if (entityType === 'user') {
      for (const e of this.store.all('security_events', { eq: { user_id: entityId }, order: 'ts', dir: 'asc', limit: 500 })) {
        push(e.ts, 'LOGIN', `${e.kind.replace(/_/g, ' ')}`, e.detail ?? null, null);
      }
      for (const t of this.store.all('transactions', { eq: { user_id: entityId }, order: 'ts', dir: 'asc', limit: 500 })) {
        push(t.ts, t.kind, `${t.kind} ${t.asset ?? ''} ${t.amount != null ? toHuman(t.asset ?? 'USDT', t.amount) : ''}`.trim(),
          t.status, null);
      }
      for (const r of this.store.all('risk_events', { eq: { user_id: entityId }, order: 'ts', dir: 'asc', limit: 200 })) {
        push(r.ts, 'RISK EVENT', `${r.level} risk — ${r.type}`, r.rules.map((x) => x.name).join('; '), 'risk-engine');
      }
      const uOrderIds = this.store.all('orders', { eq: { user_id: entityId } }).map((o) => o.id);
      for (const oe of this.store.all('order_events', { in: { order_id: uOrderIds }, order: 'ts', dir: 'asc', limit: 300 })) {
        push(oe.ts, 'ORDER', `Order ${oe.order_id.slice(0, 8)}: ${oe.from_state ?? '—'} → ${oe.to_state}`, oe.reason ?? null, oe.actor);
      }
      const oa = this.store.all('operator_actions', { limit: 1000 });
      for (const a of oa) {
        const rel = a.entity_id === entityId || (a.request_meta?.target === entityId) || (a.meta?.user_id === entityId);
        if (rel) push(a.ts, 'OPERATOR ACTION', a.action, a.reason ?? null, a.actor);
      }
    }
    if (entityType === 'order') {
      for (const e of this.store.all('order_events', { eq: { order_id: entityId }, order: 'ts', dir: 'asc', limit: 300 })) {
        push(e.ts, 'ORDER', `${e.from_state ?? '—'} → ${e.to_state}`, e.reason ?? null, e.actor);
      }
    }
    if (entityType === 'withdrawal') {
      const wd = this.store.get('withdrawals', entityId);
      if (wd) {
        push(wd.ts, 'WITHDRAWAL', `Withdrawal requested: ${wd.asset}`, `status ${wd.status}`, wd.user_id);
        for (const a of wd.approvals ?? []) push(a.ts, 'APPROVAL', `Approved by operator`, a.reason ?? null, a.by);
        if (wd.status === 'CONFIRMED') push(Date.now(), 'COMPLETION', 'Withdrawal confirmed on chain (simulated)', null, null);
      }
    }
    if (entityType === 'market') {
      for (const mc of this.store.all('market_controls', { eq: { pair: entityId }, order: 'ts', dir: 'asc', limit: 100 })) {
        push(mc.ts, 'MARKET CONTROL', `State → ${mc.state}`, mc.reason ?? null, mc.updated_by);
      }
      for (const r of this.store.all('risk_events', { eq: { entity_id: entityId }, order: 'ts', dir: 'asc', limit: 100 })) {
        push(r.ts, 'RISK EVENT', `${r.level} — ${r.type}`, r.rules.map((x) => x.name).join('; '), 'risk-engine');
      }
    }
    if (entityType === 'system') {
      for (const sc of this.store.all('system_controls', { order: 'ts', dir: 'asc', limit: 100 })) {
        push(sc.ts, 'SYSTEM', `Control "${sc.key}" → ${sc.value}`, sc.reason ?? null, sc.updated_by);
      }
      const audits = this.store.all('audit_logs', { limit: 300 });
      for (const a of audits) if (a.target_type === 'system') push(a.ts, 'SYSTEM', a.action, a.reason ?? null, a.actor);
    }
    return items.sort((a, b) => a.ts - b.ts).slice(-300);
  }
}
