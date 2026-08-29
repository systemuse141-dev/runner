// Demo seed: a coherent, clearly-simulated world.
// All ledger balances are built from real ledger operations, so the demo
// ledger reconciles exactly.

import { hashPassword } from './services/auth.js';
import * as ledger from './domain/ledger.js';
import { assessRisk } from './domain/risk.js';
import { toMinor } from '../../shared/money.js';
import { FEE_TIERS, PERMISSIONS, ROLES } from '../../shared/contracts.js';
import { mulberry32 } from './domain/rng.js';

export const DEMO_USERS = [
  { id: 'u_alice', email: 'alice@novaex.demo', name: 'Alice Chen', role: 'user' },
  { id: 'u_dana', email: 'dana@novaex.demo', name: 'Dana Reyes', role: 'trader' },
  { id: 'u_greg', email: 'greg@novaex.demo', name: 'Greg Osei', role: 'user' },
  { id: 'u_ops', email: 'ops@novaex.demo', name: 'Oscar Vale', role: 'operator' },
  { id: 'u_maya', email: 'maya@novaex.demo', name: 'Maya Lindqvist', role: 'admin' },
];
export const DEMO_PASSWORD = 'Nova-Demo-1';

export async function runSeed(ctx) {
  const { store, markets, notify, audit, wallets } = ctx;
  const now = Date.now();
  const H = 3600e3, D = 24 * H;

  // ---- roles, permissions, fee schedule ------------------------------------
  for (const role of ROLES) store.insert('roles', { id: `role_${role}`, name: role, description: role });
  for (const [role, perms] of Object.entries(PERMISSIONS)) {
    for (const p of perms) store.insert('permissions', { id: crypto.randomUUID(), role_name: role, permission: p });
  }
  for (const t of FEE_TIERS) {
    store.insert('fees', { id: `fee_${t.id}`, tier_id: t.id, min_volume: toMinor('USDT', String(t.minVolumeUsdt)), taker_bps: t.takerBps, maker_bps: t.makerBps, active: true, ts: now });
  }

  // ---- users ----------------------------------------------------------------
  for (const d of DEMO_USERS) {
    const user = store.insert('users', {
      id: d.id, email: d.email, name: d.name,
      password_hash: hashPassword(DEMO_PASSWORD),
      role: d.role, totp_secret: null, account_status: 'ACTIVE',
      created_at: now - 90 * D,
    });
    store.insert('profiles', { id: crypto.randomUUID(), user_id: d.id, full_name: d.name, locale: 'en-US', theme: 'dark', created_at: user.created_at });
    store.insert('security_events', { id: crypto.randomUUID(), user_id: d.id, kind: 'REGISTER', detail: 'Account created (demo seed)', ip: '127.0.0.1', success: true, ts: user.created_at });
    await wallets.ensureWallets(user);
  }
  const greg = store.get('users', 'u_greg');

  // NOTE: candle history is seeded by the caller (index.js) before runSeed.

  // ---- deposits (real ledger ops) ---------------------------------------------
  for (const [uid, asset, amt] of [['u_alice', 'USDT', '85,000'], ['u_dana', 'USDT', '150,000'], ['u_greg', 'USDT', '3,200']]) {
    const minor = toMinor(asset, amt);
    ledger.ops.deposit(store, { uid, asset, amount: minor, idem: `seed-dep:${uid}:${asset}`, ref: `seed:${uid}` });
    store.insert('deposits', {
      id: `DEP-${String(store.nextSeq('deposit')).padStart(5, '0')}`,
      user_id: uid, asset, network: 'erc20', address: 'seed', amount: minor,
      status: 'CONFIRMED', confirmations: 2, tx_hash: '0xseed', simulated: true, ts: now - 30 * D, updated_at: now - 30 * D,
    });
  }

  // ---- historical fills through the real ledger --------------------------------
  // sequenced so the seeded flagged order lands exactly on 92832
  let orderSeq = 92811;
  const candleAt = (pair, ts) => {
    const st = markets.markets.get(pair);
    let best = st.last;
    for (let i = st.candles.length - 1; i >= 0; i--) {
      if (st.candles[i].ts <= ts) { best = st.candles[i].c; break; }
    }
    return best;
  };

  const seedMarketFill = (uid, pair, side, qtyHuman, priceMinor, ts, num) => {
    const [base, quote] = pair.split('/');
    const qty = toMinor(base, qtyHuman);
    const notional = Math.round((qty * priceMinor) / 10 ** 8);
    const fee = Math.max(1, Math.round((notional * 10) / 10000)); // 10bps taker
    const id = crypto.randomUUID();
    ledger.ops.marketFill(store, { uid, base, quote, qty, notional, fee, side, idem: `seed-fill:${id}`, ref: id });
    store.insert('orders', {
      id, num, user_id: uid, pair, base, quote, side, type: 'MARKET', state: 'FILLED',
      price: priceMinor, stop_price: null, qty, quote_amount: notional,
      filled: qty, quote_filled: notional, avg_price: priceMinor, fee, fee_asset: quote,
      risk_level: 'LOW', risk_events: [], amendment_requested: false,
      created_at: ts, updated_at: ts + 4000,
    });
    store.insert('order_fills', { id: crypto.randomUUID(), order_id: id, price: priceMinor, qty, fee, side, maker_taker: 'taker', ts: ts + 3000 });
    store.insert('trades', { id: crypto.randomUUID(), user_id: uid, order_id: id, pair, side, price: priceMinor, qty, notional, fee, fee_asset: quote, maker_taker: 'taker', ts: ts + 3000 });
    store.insert('transactions', { id: crypto.randomUUID(), user_id: uid, kind: 'TRADE', ref_type: 'order', ref_id: id, asset: base, amount: qty, status: 'COMPLETED', meta: { pair, price: priceMinor, notional, fee, side }, ts: ts + 3000 });
    const steps = ['CREATED', 'VALIDATING', 'OPEN', 'FILLED'];
    steps.forEach((st, i) => {
      store.insert('order_events', { id: crypto.randomUUID(), order_id: id, from_state: i === 0 ? null : steps[i - 1], to_state: st, actor: 'system', actor_role: 'system', reason: st === 'FILLED' ? `Filled at ${priceMinor}` : st, ts: ts + i * 300 });
    });
  };

  const hist = [
    ['u_alice', 'BTC/USDT', 'BUY', '0.030', now - 26 * D],
    ['u_alice', 'ETH/USDT', 'BUY', '0.800', now - 21 * D],
    ['u_alice', 'SOL/USDT', 'BUY', '12.0', now - 15 * D],
    ['u_alice', 'BTC/USDT', 'SELL', '0.005', now - 9 * D],
    ['u_alice', 'ETH/USDT', 'SELL', '0.250', now - 6 * D],
    ['u_alice', 'SOL/USDT', 'BUY', '8.0', now - 4 * D],
    ['u_alice', 'BTC/USDT', 'BUY', '0.025', now - 2 * D],
    ['u_alice', 'LINK/USDT', 'BUY', '45', now - 20 * H],
    ['u_dana', 'BTC/USDT', 'BUY', '0.080', now - 24 * D],
    ['u_dana', 'SOL/USDT', 'BUY', '55.0', now - 18 * D],
    ['u_dana', 'ETH/USDT', 'BUY', '0.500', now - 12 * D],
    ['u_dana', 'LINK/USDT', 'BUY', '30', now - 8 * D],
    ['u_dana', 'BTC/USDT', 'SELL', '0.010', now - 5 * D],
    ['u_dana', 'SOL/USDT', 'BUY', '25.0', now - 3 * D],
    ['u_dana', 'AVAX/USDT', 'BUY', '120', now - 26 * H],
    ['u_greg', 'DOGE/USDT', 'BUY', '5,000', now - 10 * D],
  ];
  for (const [uid, pair, side, qty, ts] of hist) {
    seedMarketFill(uid, pair, side, qty, candleAt(pair, ts), ts, orderSeq++);
  }

  // cancelled history (no ledger impact — reserve/unreserve net to zero)
  for (const [uid, pair, side, ts] of [['u_alice', 'BTC/USDT', 'BUY', now - 7 * D], ['u_dana', 'ETH/USDT', 'SELL', now - 11 * D], ['u_greg', 'DOGE/USDT', 'BUY', now - 3 * D]]) {
    const [base] = pair.split('/');
    const qty = toMinor(base, side === 'BUY' ? '0.001' : '0.5');
    const id = crypto.randomUUID();
    store.insert('orders', {
      id, num: orderSeq++, user_id: uid, pair, base, quote: 'USDT', side, type: 'LIMIT',
      state: 'CANCELLED', price: candleAt(pair, ts), stop_price: null, qty, quote_amount: 0,
      filled: 0, quote_filled: 0, avg_price: null, fee: 0, fee_asset: 'USDT',
      risk_level: 'LOW', risk_events: [], amendment_requested: false, created_at: ts, updated_at: ts + 150_000,
    });
    const steps = ['CREATED', 'VALIDATING', 'OPEN', 'CANCEL_REQUESTED', 'CANCELLED'];
    steps.forEach((st, i) => {
      store.insert('order_events', { id: crypto.randomUUID(), order_id: id, from_state: i === 0 ? null : steps[i - 1], to_state: st, actor: i === 0 || i === 3 ? 'user' : 'system', actor_role: i === 0 || i === 3 ? 'user' : 'system', reason: st, ts: ts + i * 30_000 });
    });
  }

  // ---- dana's open resting orders ---------------------------------------------
  const openLimit = (uid, pair, side, qtyHuman, priceMinor, ts, num) => {
    const [base, quote] = pair.split('/');
    const qty = toMinor(base, qtyHuman);
    const notional = Math.round((qty * priceMinor) / 10 ** 8);
    const fee = Math.max(1, Math.round((notional * 7) / 10000)); // 7bps maker
    const id = crypto.randomUUID();
    if (side === 'BUY') ledger.ops.reserveForOrder(store, { uid, asset: quote, amount: notional + fee, idem: `seed-resv:${id}`, ref: id });
    else ledger.ops.reserveForOrder(store, { uid, asset: base, amount: qty, idem: `seed-resv:${id}`, ref: id });
    store.insert('orders', {
      id, num, user_id: uid, pair, base, quote, side, type: 'LIMIT', state: 'OPEN',
      price: priceMinor, stop_price: null, qty, quote_amount: notional,
      filled: 0, quote_filled: 0, avg_price: null, fee: 0, fee_asset: quote,
      risk_level: 'LOW', risk_events: [], amendment_requested: false, created_at: ts, updated_at: ts,
    });
    ['CREATED', 'VALIDATING', 'OPEN'].forEach((st, i) => {
      store.insert('order_events', { id: crypto.randomUUID(), order_id: id, from_state: i === 0 ? null : ['CREATED', 'VALIDATING'][i - 1], to_state: st, actor: 'system', actor_role: 'system', reason: st, ts: ts + i * 250 });
    });
    return id;
  };
  openLimit('u_dana', 'SOL/USDT', 'BUY', '40.0', Math.round(markets.markets.get('SOL/USDT').last * 0.985), now - 3 * H, orderSeq++);
  openLimit('u_dana', 'ETH/USDT', 'SELL', '0.400', Math.round(markets.markets.get('ETH/USDT').last * 1.012), now - 5 * H, orderSeq++);

  // ---- THE flagged order: 92832 -----------------------------------------------
  let flaggedOrderId;
  {
    const pair = 'BTC/USDT';
    const price = toMinor('USDT', '112,000');
    const qty = toMinor('BTC', '0.25');
    const notional = Math.round((qty * price) / 1e8); // 28,000 USDT
    const fee = Math.max(1, Math.round((notional * 7) / 10000));
    const id = crypto.randomUUID();
    flaggedOrderId = id;
    ledger.ops.reserveForOrder(store, { uid: 'u_dana', asset: 'USDT', amount: notional + fee, idem: `seed-resv:${id}`, ref: id });
    store.insert('orders', {
      id, num: orderSeq++, user_id: 'u_dana', pair, base: 'BTC', quote: 'USDT', side: 'BUY', type: 'LIMIT',
      state: 'MANUAL_REVIEW', price, stop_price: null, qty, quote_amount: notional,
      filled: 0, quote_filled: 0, avg_price: null, fee: 0, fee_asset: 'USDT',
      risk_level: 'HIGH', risk_events: [], amendment_requested: false,
      created_at: now - 42 * 60e3, updated_at: now - 41 * 60e3,
    });
    const res = assessRisk({ orderNotionalUsdt: Math.round(notional / 100), avgOrderNotionalUsdt: 4200 });
    const riskEvent = store.insert('risk_events', {
      id: `RISK-${String(store.nextSeq('risk')).padStart(5, '0')}`,
      type: 'order', entity_type: 'order', entity_id: id, user_id: 'u_dana',
      level: res.level, score: res.score, rules: res.rules,
      data: { orderNotionalUsdt: Math.round(notional / 100), avgOrderNotionalUsdt: 4200, notional },
      status: 'OPEN', resolved_by: null, ts: now - 41 * 60e3, updated_at: now - 41 * 60e3,
    });
    store.update('orders', id, { risk_events: [riskEvent.id] });
    store.insert('manual_reviews', {
      id: crypto.randomUUID(), kind: 'order', entity_id: id, level: res.level,
      reason: res.rules[0]?.detail ?? 'Order size anomaly', status: 'OPEN', assigned_to: null, ts: now - 41 * 60e3,
    });
    const steps = [['CREATED', 'user', 'Order submitted'], ['VALIDATING', 'system', 'Validation started'], ['MANUAL_REVIEW', 'system', `Risk ${res.level}: ${res.rules.map((r) => r.id).join(', ')}`]];
    steps.forEach(([st, actor, reason], i) => {
      store.insert('order_events', { id: crypto.randomUUID(), order_id: id, from_state: i === 0 ? null : steps[i - 1][0], to_state: st, actor, actor_role: actor, reason, ts: now - 42 * 60e3 + i * 10_000 });
    });
    await notify.send('u_dana', { kind: 'order_review', title: 'Order requires review', body: `Order ${orderSeq - 1} (BTC/USDT BUY) was held for manual review: ${res.rules[0]?.detail ?? 'risk control'}.` });
  }

  // ---- withdrawals ---------------------------------------------------------------
  const wd = (uid, asset, amtHuman, address, ts, status, { riskCtx = {}, riskLevel = 'LOW', required = 1, approvals = [], network = 'erc20' } = {}) => {
    const amount = toMinor(asset, amtHuman);
    const id = `WD-${String(store.nextSeq('withdrawal')).padStart(5, '0')}`;
    const fee = toMinor(asset, asset === 'USDT' ? '1' : '0.001');
    if (status !== 'REJECTED') ledger.ops.withdrawalReserve(store, { uid, asset, amount, idem: `seed-wd-resv:${id}`, ref: id });
    if (['CONFIRMED', 'BROADCAST'].includes(status)) ledger.ops.withdrawalSettle(store, { uid, asset, amount, idem: `seed-wd-settle:${id}`, ref: id });
    const res = assessRisk(riskCtx);
    const riskEvent = store.insert('risk_events', {
      id: `RISK-${String(store.nextSeq('risk')).padStart(5, '0')}`,
      type: 'withdrawal', entity_type: 'withdrawal', entity_id: id, user_id: uid,
      level: riskLevel, score: riskLevel === 'LOW' ? 0 : res.score, rules: riskLevel === 'LOW' ? [] : res.rules,
      data: { asset, amount, address, network, ...riskCtx },
      status: riskLevel === 'LOW' ? 'RESOLVED' : 'OPEN', resolved_by: riskLevel === 'LOW' ? 'system' : null,
      ts, updated_at: ts,
    });
    store.insert('withdrawals', {
      id, num: store.nextSeq('withdrawal_num'), user_id: uid, asset, network, address,
      amount, fee, status, risk_level: riskLevel, risk_event: riskEvent.id,
      verification_status: 'NONE', tx_hash: status === 'CONFIRMED' ? '0xseedconfirmed' : null,
      simulated: true, required_approvals: required, approvals, ts, updated_at: ts,
    });
    store.insert('transactions', {
      id: crypto.randomUUID(), user_id: uid, kind: 'WITHDRAWAL', ref_type: 'withdrawal', ref_id: id,
      asset, amount, status: status === 'CONFIRMED' ? 'COMPLETED' : status === 'IN_REVIEW' ? 'IN_REVIEW' : status,
      meta: { network, address, simulated: true }, ts,
    });
    return { id, riskEventId: riskEvent.id };
  };

  // greg: velocity — 3 confirmed earlier, 4th under review (HIGH, R2)
  for (let i = 0; i < 3; i++) {
    wd('u_greg', 'USDT', ['420', '380', '310'][i], `0x${'ab'.repeat(12)}g${i}known`, now - (4 - i) * 14 * 60e3, 'CONFIRMED', { riskCtx: { amountUsdt: 350, isNewDestination: i === 2, withdrawalsInWindow: 0 } });
  }
  const gregWd = wd('u_greg', 'USDT', '290', `0x${'cd'.repeat(12)}gnew`, now - 6 * 60e3, 'IN_REVIEW', {
    riskCtx: { amountUsdt: 290, isNewDestination: true, withdrawalsInWindow: 3 },
    riskLevel: 'HIGH', required: 1,
  });
  store.insert('manual_reviews', { id: crypto.randomUUID(), kind: 'withdrawal', entity_id: gregWd.id, level: 'HIGH', reason: 'Unusual velocity — 4 withdrawals in the last hour (R2_VELOCITY) + new destination (R3)', status: 'OPEN', assigned_to: null, ts: now - 5 * 60e3 });

  // dana: high-value + new destination → CRITICAL, dual approval, 1 of 2 in
  const danaWd = wd('u_dana', 'USDT', '60,000', `0x${'a1'.repeat(12)}danaNew`, now - 22 * 60e3, 'IN_REVIEW', {
    riskCtx: { amountUsdt: 60_000, isNewDestination: true, withdrawalsInWindow: 0 },
    riskLevel: 'CRITICAL', required: 2,
    approvals: [{ by: 'u_ops', role: 'operator', reason: 'First approval — verifying ID documents', ts: now - 15 * 60e3 }],
  });
  store.insert('manual_reviews', { id: crypto.randomUUID(), kind: 'withdrawal', entity_id: danaWd.id, level: 'CRITICAL', reason: 'High-value (R1_HIGH_VALUE) + new destination (R3_NEW_DESTINATION) — dual approval in progress', status: 'OPEN', assigned_to: 'u_ops', ts: now - 20 * 60e3 });

  // alice: small + new destination → MEDIUM single review
  const aliceWd = wd('u_alice', 'USDT', '3,500', `T${'nova'.repeat(8)}alice`, now - 50 * 60e3, 'IN_REVIEW', {
    riskCtx: { amountUsdt: 3500, isNewDestination: true, withdrawalsInWindow: 0 },
    riskLevel: 'MEDIUM', network: 'trc20',
  });
  store.insert('manual_reviews', { id: crypto.randomUUID(), kind: 'withdrawal', entity_id: aliceWd.id, level: 'MEDIUM', reason: 'New destination (R3_NEW_DESTINATION)', status: 'OPEN', assigned_to: null, ts: now - 48 * 60e3 });

  // ---- market anomaly incident (DOGE) -------------------------------------------
  {
    const res = assessRisk({ volatilityRatio: 3.4 });
    store.insert('risk_events', {
      id: `RISK-${String(store.nextSeq('risk')).padStart(5, '0')}`,
      type: 'market', entity_type: 'market', entity_id: 'DOGE/USDT', user_id: null,
      level: 'MEDIUM', score: res.score, rules: res.rules,
      data: { volatilityRatio: 3.4 }, status: 'OPEN', resolved_by: null, ts: now - 35 * 60e3, updated_at: now - 35 * 60e3,
    });
  }

  // ---- balance adjustment (dual, pending second approver) ------------------------
  let adjId, adjApprovalId;
  {
    const delta = toMinor('USDT', '6,000');
    adjId = `ADJ-${String(store.nextSeq('adjustment')).padStart(4, '0')}`;
    store.insert('balance_adjustments', {
      id: adjId, user_id: 'u_greg', asset: 'USDT', delta,
      reason: 'Goodwill credit: compensation for the 14-min trading outage (incident INC-118)',
      reference: 'INC-118', evidence: { incident_ref: 'INC-118', ops_ticket: '#4471', customer_ack: true },
      status: 'REQUESTED', requested_by: 'u_ops', required_approvals: 2,
      approvals: [{ by: 'u_ops', role: 'operator', reason: 'Request authorization', ts: now - 3 * H }],
      executed_by: null, ts: now - 3 * H, updated_at: now - 3 * H,
    });
    adjApprovalId = `APP-${String(store.nextSeq('approval')).padStart(5, '0')}`;
    store.insert('approval_requests', {
      id: adjApprovalId,
      scope: 'balance_adjustment', action: 'adjustment_execute',
      target_type: 'balance_adjustment', target_id: adjId,
      requested_by: 'u_ops', requested_role: 'operator',
      reason: 'Goodwill credit for INC-118 (6,000 USDT → greg@novaex.demo)', meta: { adjId },
      required_approvals: 2, approvals: [{ by: 'u_ops', role: 'operator', reason: 'Request authorization', ts: now - 3 * H }], rejections: [],
      status: 'PENDING', executed_by: null, execution_result: null,
      ts: now - 3 * H, expires_at: now + 21 * H,
    });
    store.insert('manual_reviews', { id: crypto.randomUUID(), kind: 'adjustment', entity_id: adjId, level: 'HIGH', reason: `Balance adjustment ${adjId} — 6,000 USDT to ${greg.email} (dual approval)`, status: 'OPEN', assigned_to: null, ts: now - 3 * H });
  }

  // ---- audit trail -----------------------------------------------------------------
  const auditSeed = [
    ['u_ops', 'operator', 'auth.login', 'system', null, null, null, now - 26 * H],
    ['u_maya', 'admin', 'auth.login', 'system', null, null, null, now - 25 * H],
    ['u_ops', 'operator', 'order.risk_hold', 'order', flaggedOrderId, 'VALIDATING', 'MANUAL_REVIEW', 'Order 92832 auto-routed by risk engine (R6_ORDER_ANOMALY)', now - 41 * 60e3],
    ['u_ops', 'operator', 'withdrawal.approve', 'withdrawal', danaWd.id, 'IN_REVIEW', 'IN_REVIEW', 'First approval — verifying ID documents', now - 15 * 60e3],
    ['u_maya', 'admin', 'auth.login', 'system', null, null, null, now - 2 * H],
    ['u_ops', 'operator', 'adjustment.create', 'balance_adjustment', adjId, null, 'REQUESTED', 'Goodwill credit INC-118', now - 3 * H],
  ];
  for (const [actor, role, action, ttype, tid, oldS, newS, reason, ts] of auditSeed) {
    await audit.record({ actor, role, action, targetType: ttype, targetId: tid, oldState: oldS, newState: newS, reason, forceTs: ts });
  }

  // ---- notifications ------------------------------------------------------------------
  await notify.send('u_alice', { kind: 'withdrawal_review', title: 'Withdrawal pending review', body: 'Your 3,500 USDT withdrawal is being reviewed (new destination).' });
  await notify.send('u_alice', { kind: 'welcome', title: 'Welcome to NOVAEX', body: 'Tip: set up 2FA in Security → Two-factor authentication.' });
  await notify.send('u_dana', { kind: 'withdrawal_review', title: 'High-value withdrawal in dual review', body: 'Your 60,000 USDT withdrawal requires a second operator approval (1/2 complete).' });
  await notify.send('u_greg', { kind: 'withdrawal_review', title: 'Withdrawal flagged for velocity', body: 'One of your withdrawals is under manual review due to recent transfer activity.' });

  // freeze sequences so demo IDs stay canonical (next order = 92833+)
  store.setSeq?.('order_num', 92832);

  ctx.config._marketSvc = markets;
  return { users: DEMO_USERS, password: DEMO_PASSWORD };
}
