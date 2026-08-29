// NOVA AI — contextual assistant. Deterministic intent engine.
// It EXPLAINS stored data and PROPOSES actions; sensitive actions always go
// through authorization (and dual approval where policy requires it).
// The AI never invents events and never executes sensitive actions silently.

import { POLICY } from '../../../shared/contracts.js';
import { RISK_RULES } from '../domain/risk.js';
import { toHuman } from '../../../shared/money.js';
import { createApproval } from '../domain/approvals.js';

export class AIError extends Error {
  constructor(msg, code = 'AI_ERROR') {
    super(msg);
    this.name = 'AIError';
    this.code = code;
    this.status = 400;
  }
}

const H = 3600e3;

export class AIService {
  constructor(ctx) {
    this.store = ctx.store;
    this.markets = ctx.markets;
    this.config = ctx.config;
    this.approvals = ctx.approvals;
    this.system = ctx.system;
    this.marketOps = ctx.marketOps;
    this.audit = ctx.audit;
    this.bus = ctx.bus;
  }

  /**
   * Handle a chat message.
   * @param user authenticated principal
   * @param message text
   * @param context { mode, entityType, entityId } current UI context
   */
  async chat(user, message, context = {}) {
    const q = String(message ?? '').trim();
    const isOps = user.role === 'operator' || user.role === 'admin';
    const ctx = { ...context, isOps };

    if (!q) return this._reply('How can I help?', [
      { kind: 'suggestions', data: this.suggestions(user) },
    ]);

    const lower = q.toLowerCase();

    // 1. explain a flagged order
    let m = lower.match(/(?:why|explain|what|how)[^.!?]*order[ \t]+([0-9]{3,7})[^.!?]*flag|order[ \t]+([0-9]{3,7})(?:'s)?[^.!?]*(?:flag|risk|review|manual)/);
    const orderNumMatch = lower.match(/order[ \t]+([0-9]{3,7})/);
    if ((m || (orderNumMatch && /flag|risk|review|why/.test(lower))) && orderNumMatch) {
      return this._explainOrder(orderNumMatch[1]);
    }

    // 2. manual reviews
    if (/manual review|review queue|reviews?\b.*today|today.*review/.test(lower)) {
      return this._manualReviews(ctx);
    }

    // 3. withdrawals needing attention
    if (/withdrawal/.test(lower) && /(attention|pending|review|need|stuck|waiting|high.?risk)/.test(lower)) {
      return this._withdrawalsAttention(ctx);
    }

    // 4. summarize window
    m = lower.match(/summar(?:e|ize)[^.]*last[ \t]+(?:an?[ \t])?(\d+)?[ \t]*(minutes?|mins?|m|hours?|hrs?|h|days?|d)\b/);
    if (/summar/.test(lower) && (m || /last (hour|minute)/.test(lower))) {
      const ms = this._parseWindow(lower);
      return this._summarizeWindow(ms, ctx);
    }

    // 5. paused markets
    if (/(which|what).*market|paused market|market.*paused|trading paused/.test(lower)) {
      return this._pausedMarkets(ctx);
    }

    // 6. critical alerts
    if (/critical (alert|event|risk)|unresolved critical/.test(lower)) {
      return this._criticalAlerts(ctx);
    }

    // 7. find/search
    if (/^(find|search|show|locate|who|where|look up)\b/.test(lower)) {
      return this._search(ctx, q);
    }

    // 8. market summary
    m = q.match(/(BTC|ETH|SOL|XRP|ADA|DOGE|AVAX|LINK)\s*\/?\s*USDT/i);
    if (m && /summar|status|market|how (is|are)/.test(lower)) {
      return this._marketSummary(`${m[1]}/USDT`, ctx);
    }

    // 9. account/portfolio explanation (user mode)
    if (/(my )?(portfolio|account|balance|holdings|net worth)/.test(lower) && !isOps) {
      return this._accountSummary(user);
    }
    if (/(what can you do|help|capabilit|how do you work)/.test(lower)) {
      return this._help(user);
    }

    // 10. action intents -> PROPOSALS (never direct execution)
    const action = this._matchAction(lower);
    if (action) {
      return this._propose(user, action, q, ctx);
    }

    return this._help(user, 'I could not map that request to a capability. Try one of the suggestions.');
  }

  suggestions(user) {
    if (user.role === 'operator' || user.role === 'admin') {
      return [
        "Show me today's manual reviews",
        'Why is order 92832 flagged?',
        'What withdrawals require attention?',
        'Summarize the last hour',
        'Which markets are paused?',
        'Show unresolved critical alerts',
      ];
    }
    return [
      'Summarize my portfolio',
      'Which markets are paused?',
      'Summarize the last hour',
      'Explain my last transaction',
    ];
  }

  // ------------------------------------------------------------------ intents

  _reply(text, blocks = []) {
    return { text, blocks };
  }

  async _explainOrder(num) {
    const order = (await this.store.all('orders', { limit: 5000 })).find((o) => String(o.num) === String(num));
    if (!order) return this._reply(`I could not find order ${num} in the records.`, []);
    const riskEvents = (order.risk_events ?? []).map((id) => this.store.get('risk_events', id)).filter(Boolean);
    const events = this.store.all('order_events', { eq: { order_id: order.id }, order: 'ts', dir: 'asc', limit: 100 });
    const user = this.store.get('users', order.user_id);

    let text;
    if (riskEvents.length) {
      const re = riskEvents[0];
      const rules = re.rules.map((r) => {
        const rule = RISK_RULES[r.id];
        return `• **${r.id} — ${r.name}**: ${r.detail}${rule ? ` (policy rule: ${rule.description})` : ''}`;
      }).join('\n');
      text = `Order **${order.num}** (${order.pair} ${order.side} ${order.type}) is at state **${order.state}** with risk level **${re.level}**. The risk engine recorded these policy rules — I am reading them from the stored risk event ${re.id}, not estimating:\n${rules}`;
    } else {
      text = `Order **${order.num}** (${order.pair} ${order.side} ${order.type}, user ${user?.email ?? 'unknown'}) is at state **${order.state}** with risk level **${order.risk_level}**. No risk events are recorded against this order.`;
    }
    return this._reply(text, [
      { kind: 'order', data: { num: order.num, pair: order.pair, side: order.side, type: order.type, state: order.state, risk_level: order.risk_level } },
      { kind: 'risk_events', data: riskEvents },
      { kind: 'timeline', data: events.map((e) => ({ ts: e.ts, from: e.from_state, to: e.to_state, actor: e.actor, reason: e.reason })) },
    ]);
  }

  async _manualReviews(ctx) {
    const since = Date.now() - 24 * H;
    const open = this.store.all('manual_reviews', { eq: { status: 'OPEN' }, order: 'ts', dir: 'desc', limit: 50 });
    const today = open.filter((r) => r.ts >= since);
    const lines = today.length
      ? today.map((r) => `• ${r.kind} \`${r.entity_id}\` — **${r.level}** (${r.reason ?? 'no reason recorded'})`).join('\n')
      : 'No open manual reviews today.';
    return this._reply(`**${today.length}** open manual review(s) in the last 24h:\n${lines}`, [
      { kind: 'table', data: { title: 'Manual reviews', rows: today.map((r) => ({ kind: r.kind, entity: r.entity_id, level: r.level, reason: r.reason, ts: r.ts })) } },
    ]);
  }

  async _withdrawalsAttention(ctx) {
    const list = this.store.all('withdrawals', { order: 'ts', dir: 'desc', limit: 100 })
      .filter((w) => ['IN_REVIEW', 'HELD'].includes(w.status) || ['HIGH', 'CRITICAL'].includes(w.risk_level));
    const lines = list.length
      ? list.map((w) => {
          const u = this.store.get('users', w.user_id);
          return `• \`${w.id}\` — ${u?.email ?? w.user_id}, ${toHuman(w.asset, w.amount)} ${w.asset}, **${w.risk_level}**, status ${w.status}${w.required_approvals > 1 ? ` (dual approval ${w.approvals.length}/${w.required_approvals})` : ''}`;
        }).join('\n')
      : 'No withdrawals currently require attention.';
    return this._reply(`**${list.length}** withdrawal(s) need attention:\n${lines}`, [
      { kind: 'table', data: { title: 'Withdrawals', rows: list.map((w) => ({ id: w.id, asset: w.asset, amount: toHuman(w.asset, w.amount), risk: w.risk_level, status: w.status })) } },
    ]);
  }

  async _summarizeWindow(ms, ctx) {
    const since = Date.now() - ms;
    const orders = this.store.all('orders', { gte: { created_at: since }, limit: 500 });
    const fills = orders.filter((o) => o.state === 'FILLED');
    const withdrawals = this.store.all('withdrawals', { gte: { ts: since }, limit: 200 });
    const risk = this.store.all('risk_events', { gte: { ts: since }, limit: 200 });
    const approvals = this.store.all('approval_requests', { gte: { ts: since }, limit: 200 });
    const actions = this.store.all('operator_actions', { gte: { ts: since }, limit: 500 });
    const reviews = this.store.all('manual_reviews', { gte: { ts: since }, limit: 100 });
    const critical = risk.filter((r) => r.level === 'CRITICAL');

    const text =
      `**Last ${Math.round(ms / H)} hour snapshot**\n` +
      `• Orders created: **${orders.length}** (filled ${fills.length}, in review ${orders.filter((o) => o.state === 'MANUAL_REVIEW').length})\n` +
      `• Withdrawals: **${withdrawals.length}** (pending review ${withdrawals.filter((w) => ['IN_REVIEW', 'HELD'].includes(w.status)).length})\n` +
      `• Risk events: **${risk.length}** — ${critical.length ? `**${critical.length} CRITICAL**` : 'none critical'}\n` +
      `• Operator actions: **${actions.length}**, approvals processed: **${approvals.length}**\n` +
      `• New manual reviews: **${reviews.filter((r) => r.status === 'OPEN').length}**`;
    return this._reply(text, [
      { kind: 'kv', data: { orders: orders.length, filled: fills.length, withdrawals: withdrawals.length, riskEvents: risk.length, critical: critical.length, operatorActions: actions.length } },
    ]);
  }

  _parseWindow(lower) {
    const m = lower.match(/last[ \t]+(?:an?[ \t])?(\d+)?[ \t]*(minutes?|mins?|m|hours?|hrs?|h|days?|d)\b/);
    if (!m) return 1 * H;
    const n = Math.max(1, Number(m[1] ?? 1));
    const unit = m[2][0];
    if (unit === 'm') return n * 60e3;
    if (unit === 'h') return n * H;
    return n * 24 * H;
  }

  async _pausedMarkets(ctx) {
    const controls = this.store.all('market_controls', { limit: 100 });
    const paused = controls.filter((c) => c.state !== 'TRADING');
    const sys = this.store.all('system_controls', { limit: 50 });
    const lines = [
      ...paused.map((c) => `• **${c.pair}** — ${c.state} (${c.reason ?? 'no reason recorded'}${c.updated_by ? `, by ${this.store.get('users', c.updated_by)?.email ?? c.updated_by}` : ''})`),
    ];
    const sysLines = sys
      .filter((s) => s.value === 'PAUSED' || s.value === 'true')
      .map((s) => `• Global control **${s.key}** = ${s.value}`);
    const none = !lines.length && !sysLines.length;
    return this._reply(
      none
        ? 'All markets are **TRADING** and no global controls are paused.'
        : `Current paused state:\n${[...lines, ...sysLines].join('\n')}`,
      [{ kind: 'table', data: { title: 'Market controls', rows: controls.map((c) => ({ pair: c.pair, state: c.state, reason: c.reason })) } }]
    );
  }

  async _criticalAlerts(ctx) {
    const crit = this.store.all('risk_events', { eq: { status: 'OPEN', level: 'CRITICAL' }, order: 'ts', dir: 'desc', limit: 50 });
    const high = this.store.all('risk_events', { eq: { status: 'OPEN', level: 'HIGH' }, order: 'ts', dir: 'desc', limit: 50 });
    const text =
      `**${crit.length}** unresolved CRITICAL and **${high.length}** unresolved HIGH risk events.\n` +
      (crit.length ? crit.map((r) => `• \`${r.id}\` ${r.type}/${r.entity_id ?? ''} — ${r.rules.map((x) => x.name).join('; ')}`).join('\n') : 'None critical.').replace(/^None critical\.$/, 'No critical events open.');
    return this._reply(text, [
      { kind: 'table', data: { title: 'Unresolved critical', rows: crit.map((r) => ({ id: r.id, type: r.type, entity: r.entity_id, rules: r.rules.map((x) => x.id).join(', '), ts: r.ts })) } },
    ]);
  }

  async _search(ctx, q) {
    const term = q.replace(/^(find|search|show|locate|who|where|look up)\s+/i, '').trim();
    const results = { users: [], orders: [], markets: [], transactions: [], withdrawals: [], wallets: [], incidents: [] };
    const isOps = ctx.isOps;
    if (!term) return this._reply('What should I search for?', []);
    const t = term.toLowerCase();

    if (isOps) {
      results.users = this.store.all('users', { limit: 500 }).filter((u) => u.email.toLowerCase().includes(t) || u.name.toLowerCase().includes(t)).slice(0, 5);
    }
    const scope = isOps ? {} : { eq: { user_id: ctx.user?.id } };
    results.orders = this.store.all('orders', scope).filter((o) => String(o.num) === t || (t && o.pair.toLowerCase().includes(t))).slice(0, 5);
    results.markets = this.markets.allSummaries().filter((mk) => mk.pair.toLowerCase().includes(t)).slice(0, 5);
    if (isOps) {
      results.withdrawals = this.store.all('withdrawals', { limit: 500 }).filter((w) => w.id.toLowerCase().includes(t)).slice(0, 5);
      results.incidents = this.store.all('risk_events', { limit: 500 }).filter((r) => r.type.includes(t) || (r.entity_id ?? '').toLowerCase().includes(t)).slice(0, 5);
    }
    const total = Object.values(results).reduce((s, arr) => s + arr.length, 0);
    if (!total) return this._reply(`No matches for “${term}” in the areas I can see.`, []);
    const text = `Found **${total}** result(s) for “${term}”:` + Object.entries(results).filter(([, v]) => v.length).map(([k, v]) => `\n${k}: ${v.length}`).join('');
    return this._reply(text, [{ kind: 'search', data: results }]);
  }

  async _marketSummary(pair, ctx) {
    const s = this.markets.summary(pair);
    if (!s) return this._reply(`I don't have data for ${pair}.`, []);
    const text =
      `**${pair}** — last **${toHuman('USDT', s.last)}**, 24h ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%.\n` +
      `High ${toHuman('USDT', s.high24h)} · Low ${toHuman('USDT', s.low24h)} · Volume ${toHuman('USDT', s.volume24h)} USDT · Spread ${s.spreadPct.toFixed(3)}%`;
    return this._reply(text, [{ kind: 'kv', data: { last: s.last, changePct: s.changePct, high: s.high24h, low: s.low24h, volume: s.volume24h, spreadPct: s.spreadPct } }]);
  }

  async _accountSummary(user) {
    const bal = this.store.all('balances', { eq: { user_id: user.id } });
    const parts = [];
    let total = 0;
    for (const b of bal) {
      const qty = b.available + b.reserved;
      if (qty <= 0) continue;
      let v;
      if (b.asset === 'USDT') v = qty;
      else {
        const st = this.markets.markets.get(`${b.asset}/USDT`);
        if (!st) continue;
        v = (qty * st.last) / 10 ** 8;
      }
      total += v;
      parts.push(`${toHuman(b.asset, qty)} ${b.asset} (≈ $${v.toLocaleString('en-US', { maximumFractionDigits: 0 })})`);
    }
    const tx = this.store.all('transactions', { eq: { user_id: user.id }, order: 'ts', dir: 'desc', limit: 5 });
    const text =
      `Your portfolio totals **≈ $${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}**${parts.length ? `: ${parts.join(', ')}` : ''}.\n` +
      `Recent activity: ${tx.slice(0, 3).map((t) => `${t.kind} ${t.status}`).join(' · ') || 'none recorded'}.`;
    return this._reply(text, [{ kind: 'kv', data: { totalUsd: Math.round(total) } }]);
  }

  _help(user, extra = null) {
    const caps = user.role === 'operator' || user.role === 'admin'
      ? 'manual reviews, flagged orders, withdrawals, summaries, paused markets, critical alerts, and action proposals (pause/resume controls).'
      : 'portfolio summaries, market summaries, and activity explanations.';
    return this._reply(`I am **NOVA AI**. I can ${caps}.\nSensitive actions are only ever *proposed* — they require your explicit authorization (and dual approval where policy demands it).${extra ? `\n\n${extra}` : ''}`, [
      { kind: 'suggestions', data: this.suggestions(user) },
    ]);
  }

  // ------------------------------------------------------------------ actions

  _matchAction(lower) {
    const pairs = [
      { kind: 'PAUSE_MARKET', re: /pause[ \t]+(the[ \t])?(market[ \t]+)?(btc|eth|sol|xrp|ada|doge|avax|link)/, },
      { kind: 'RESUME_MARKET', re: /resume[ \t]+(the[ \t])?(market[ \t]+)?(btc|eth|sol|xrp|ada|doge|avax|link)/ },
      { kind: 'PAUSE_TRADING', re: /pause[ \t]+(all[ \t]+)?(global[ \t]+)?trading/ },
      { kind: 'RESUME_TRADING', re: /resume[ \t]+(all[ \t]+)?(global[ \t]+)?trading/ },
      { kind: 'PAUSE_WITHDRAWALS', re: /pause[ \t]+withdrawals?/ },
      { kind: 'RESUME_WITHDRAWALS', re: /resume[ \t]+withdrawals?/ },
      { kind: 'MAINTENANCE_ON', re: /maintenance[ \t]+(mode)?[ \t]?(on|enable|start)/ },
      { kind: 'MAINTENANCE_OFF', re: /maintenance[ \t]+(mode)?[ \t]?(off|disable|end)/ },
    ];
    for (const p of pairs) {
      const m = lower.match(p.re);
      if (m) {
        const asset = m[3] ? m[3].toUpperCase() : null;
        return { kind: p.kind, target: asset ? `${asset}/USDT` : null };
      }
    }
    return null;
  }

  async _propose(user, action, originalText, ctx) {
    if (user.role !== 'operator' && user.role !== 'admin') {
      return this._reply('I can\'t prepare operational control actions for customer accounts. Those are operator-only.', []);
    }
    const isDual = ['PAUSE_TRADING', 'RESUME_TRADING', 'PAUSE_WITHDRAWALS', 'RESUME_WITHDRAWALS', 'MAINTENANCE_ON', 'MAINTENANCE_OFF', 'PAUSE_MARKET', 'RESUME_MARKET'].includes(action.kind);
    const meta = {
      PAUSE_MARKET: { label: 'Pause market', impact: 'New orders on this market are rejected; open orders remain. Users see a paused banner.', risk: 'MEDIUM' },
      RESUME_MARKET: { label: 'Resume market', impact: 'Trading on the market returns to normal for new orders.', risk: 'LOW' },
      PAUSE_TRADING: { label: 'Pause all trading', impact: 'All new buy and sell orders across markets are rejected. Open orders remain. This is a global emergency control.', risk: 'CRITICAL' },
      RESUME_TRADING: { label: 'Resume all trading', impact: 'Global trading returns to LIVE.', risk: 'HIGH' },
      PAUSE_WITHDRAWALS: { label: 'Pause withdrawals', impact: 'New withdrawal requests are rejected until resumed.', risk: 'HIGH' },
      RESUME_WITHDRAWALS: { label: 'Resume withdrawals', impact: 'Withdrawals accept new requests.', risk: 'MEDIUM' },
      MAINTENANCE_ON: { label: 'Enable maintenance mode', impact: 'Trading, buying, selling and withdrawals are blocked. Read-only service.', risk: 'CRITICAL' },
      MAINTENANCE_OFF: { label: 'Exit maintenance mode', impact: 'All services return to normal.', risk: 'HIGH' },
    }[action.kind];

    const proposal = await this.store.insert('ai_proposals', {
      id: `PROP-${String(await this.store.nextSeq('proposal')).padStart(4, '0')}`,
      kind: action.kind,
      target_type: action.target ? 'market' : 'system',
      target_id: action.target ?? action.kind,
      reason: `Proposed by NOVA AI from user request: “${originalText}”`,
      scope: action.target ?? 'global',
      impact: meta.impact,
      risk: meta.risk,
      required_approvals: isDual ? 2 : 1,
      status: 'PENDING',
      created_by: user.id,
      approval_id: null,
      ts: Date.now(),
      expires_at: Date.now() + POLICY.proposalTtlMs,
    });

    return this._reply(
      `I can prepare that action, but I will not execute it on my own. Here is the proposal — review it, then authorize explicitly.`,
      [{ kind: 'proposal', data: { ...proposal, label: meta.label } }]
    );
  }

  getProposal(id) {
    const p = this.store.get('ai_proposals', id);
    if (!p) throw new AIError('Proposal not found', 'NOT_FOUND');
    if (p.status === 'PENDING' && p.expires_at < Date.now()) {
      this.store.update('ai_proposals', id, { status: 'EXPIRED' });
      p.status = 'EXPIRED';
    }
    return p;
  }

  async cancelProposal(user, id) {
    const p = this.getProposal(id);
    if (p.status !== 'PENDING') throw new AIError(`Proposal is ${p.status}`, 'BAD_STATUS');
    this.store.update('ai_proposals', id, { status: 'CANCELLED' });
    await this.audit.record({
      actor: user.id, role: user.role, action: 'ai.proposal_cancelled',
      targetType: 'ai_proposal', targetId: id,
      oldState: 'PENDING', newState: 'CANCELLED',
    });
    return this.store.get('ai_proposals', id);
  }

  /** Explicit human authorization of a proposal. */
  async authorize(user, id) {
    const p = this.getProposal(id);
    if (user.role !== 'operator' && user.role !== 'admin') throw new AIError('Only operators can authorize proposals', 'FORBIDDEN');
    if (p.status !== 'PENDING') throw new AIError(`Proposal is ${p.status}`, 'BAD_STATUS');

    if (p.required_approvals >= 2) {
      const approval = createApproval(this.store, {
        scope: p.kind.includes('MARKET') ? 'market_control' : 'emergency_control',
        action: `ai_proposal:${p.kind}`,
        targetType: p.target_type, targetId: p.target_id,
        requestedBy: user.id, role: user.role,
        reason: p.reason,
        meta: { proposalId: p.id, kind: p.kind, target: p.target_id },
        required: 2,
        initialApprover: user.id,
      });
      this.store.update('ai_proposals', id, { status: 'PENDING_APPROVAL', approval_id: approval.id });
      await this.audit.record({
        actor: user.id, role: user.role, action: 'ai.proposal_authorized',
        targetType: 'ai_proposal', targetId: id,
        oldState: 'PENDING', newState: 'PENDING_APPROVAL',
        reason: 'Authorized; routed to dual approval', approvalId: approval.id,
      });
      this.bus?.pushOps({ kind: 'approval_requested', data: approval });
      return { proposal: this.store.get('ai_proposals', id), approval, dual: true };
    }

    await this._executeProposal(user, p);
    this.store.update('ai_proposals', id, { status: 'EXECUTED' });
    return { proposal: this.store.get('ai_proposals', id), dual: false };
  }

  async _executeProposal(user, p) {
    const reason = `AI proposal ${p.id} authorized by ${user.email ?? user.id}`;
    if (p.kind === 'PAUSE_MARKET' || p.kind === 'RESUME_MARKET') {
      await this.marketOps.setMarketState(p.target_id, p.kind === 'PAUSE_MARKET' ? 'PAUSED' : 'TRADING', {
        actor: user.id, role: user.role, reason,
      });
    } else {
      const map = {
        PAUSE_TRADING: ['trading', 'PAUSED'], RESUME_TRADING: ['trading', 'LIVE'],
        PAUSE_WITHDRAWALS: ['withdrawals', 'PAUSED'], RESUME_WITHDRAWALS: ['withdrawals', 'ENABLED'],
        MAINTENANCE_ON: ['maintenance', 'true'], MAINTENANCE_OFF: ['maintenance', 'false'],
      };
      const [key, value] = map[p.kind];
      this.system._setValue(key, value, { actor: user.id, role: user.role, reason });
      await this.audit.operatorAction({
        actor: user.id, role: user.role, action: `system.${key}_${value.toLowerCase()}`,
        entityType: 'system', entityId: key, reason,
        oldState: null, newState: value,
      });
    }
  }

}
