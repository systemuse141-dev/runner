// Permission-aware global search backing the command palette.

export class SearchService {
  constructor(ctx) {
    this.store = ctx.store;
    this.markets = ctx.markets;
  }

  search(user, q, limit = 6) {
    const t = String(q ?? '').trim().toLowerCase();
    const out = { users: [], orders: [], markets: [], transactions: [], wallets: [], withdrawals: [], incidents: [] };
    if (!t) return out;
    const isOps = user.role === 'operator' || user.role === 'admin';

    if (isOps) {
      out.users = this.store.all('users', { limit: 500 })
        .filter((u) => u.email.toLowerCase().includes(t) || u.name.toLowerCase().includes(t))
        .slice(0, limit)
        .map((u) => ({ id: u.id, label: `${u.name} <${u.email}>`, sub: `role ${u.role}`, url: `/ops/users/${u.id}` }));
    }
    const orderRows = this.store.all('orders', isOps ? {} : { eq: { user_id: user.id } }, {});
    out.orders = orderRows
      .filter((o) => String(o.num).includes(t) || o.pair.toLowerCase().includes(t) || o.state.toLowerCase().includes(t))
      .slice(0, limit)
      .map((o) => ({ id: o.id, label: `Order ${o.num} — ${o.pair} ${o.side}`, sub: `${o.type} · ${o.state}`, url: isOps ? `/ops/orders?focus=${o.num}` : `/pro/orders?focus=${o.num}` }));

    out.markets = this.markets.allSummaries()
      .filter((mk) => mk.pair.toLowerCase().includes(t))
      .slice(0, limit)
      .map((mk) => ({ id: mk.pair, label: mk.pair, sub: `${(mk.changePct >= 0 ? '+' : '')}${mk.changePct.toFixed(2)}%`, url: `/markets/${mk.pair.replace('/', '-')}` }));

    const txRows = this.store.all('transactions', isOps ? {} : { eq: { user_id: user.id } });
    out.transactions = txRows
      .filter((x) => x.kind.toLowerCase().includes(t) || (x.ref_id ?? '').toLowerCase().includes(t))
      .slice(0, limit)
      .map((x) => ({ id: x.id, label: `${x.kind} ${x.asset ?? ''} ${x.status}`, sub: new Date(x.ts).toLocaleString(), url: '/activity' }));

    const addrs = this.store.all('wallet_addresses', { eq: { user_id: user.id } });
    out.wallets = addrs
      .filter((w) => w.address.toLowerCase().includes(t) || w.asset.toLowerCase().includes(t))
      .slice(0, limit)
      .map((w) => ({ id: w.id, label: `${w.asset} · ${w.network}`, sub: w.address.slice(0, 18) + '…', url: '/wallet' }));

    if (isOps) {
      out.withdrawals = this.store.all('withdrawals', { limit: 500 })
        .filter((w) => w.id.toLowerCase().includes(t) || w.status.toLowerCase().includes(t) || w.asset.toLowerCase().includes(t))
        .slice(0, limit)
        .map((w) => ({ id: w.id, label: `${w.id} — ${w.asset}`, sub: `${w.risk_level} · ${w.status}`, url: '/ops/withdrawals?focus=' + w.id }));
      out.incidents = this.store.all('risk_events', { limit: 500 })
        .filter((r) => r.id.toLowerCase().includes(t) || r.type.toLowerCase().includes(t) || r.level.toLowerCase().includes(t))
        .slice(0, limit)
        .map((r) => ({ id: r.id, label: `${r.id} — ${r.type}`, sub: `${r.level} · ${r.status}`, url: '/ops/risk' }));
    }
    return out;
  }
}
