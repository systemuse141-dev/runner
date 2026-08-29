// Wallet service: addresses, deposits, withdrawals.
// BlockchainProvider is an interface; the demo uses SimulatedBlockchainProvider
// and every simulated hash is explicitly labeled.

import { NETWORKS, ASSETS, DUAL_APPROVAL } from '../../../shared/contracts.js';
import { toMinor, toHuman, decimals } from '../../../shared/money.js';
import * as ledger from '../domain/ledger.js';
import { mulberry32 } from '../domain/rng.js';

const ADDR_PREFIX = {
  bitcoin: 'bc1q',
  erc20: '0x',
  solana: '',
  trc20: 'T',
  xrpl: 'r',
  cardano: 'addr1',
  doge: 'D',
  avalanche: 'avax1',
};

export class WalletError extends Error {
  constructor(msg, code = 'WALLET_ERROR') {
    super(msg);
    this.name = 'WalletError';
    this.code = code;
    this.status = 400;
  }
}

export class WalletService {
  constructor(ctx) {
    this.store = ctx.store;
    this.audit = ctx.audit;
    this.notify = ctx.notify;
    this.risk = ctx.risk;
    this.bus = ctx.bus;
    this.config = ctx.config;
    this.timers = new Set();
  }

  async ensureWallets(user) {
    for (const asset of Object.keys(ASSETS)) {
      const exists = await this.store.all('wallets', { eq: { user_id: user.id, asset }, limit: 1 });
      if (!exists.length) await this.store.insert('wallets', { id: crypto.randomUUID(), user_id: user.id, asset, status: 'ACTIVE' });
      for (const net of NETWORKS[asset] ?? []) {
        const addr = await this.store.all('wallet_addresses', { eq: { user_id: user.id, asset, network: net.id }, limit: 1 });
        if (!addr.length) {
          await this.store.insert('wallet_addresses', {
            id: crypto.randomUUID(), user_id: user.id, asset, network: net.id,
            address: this._mockAddress(user.id, asset, net.id),
            simulated: this.config.demoMode,
            created_at: Date.now(),
          });
        }
      }
    }
  }

  _mockAddress(uid, asset, network) {
    const rng = mulberry32([...`${uid}:${asset}:${network}`].reduce((a, c) => a * 33 + c.charCodeAt(0), 5) >>> 0);
    const prefix = ADDR_PREFIX[network] ?? 'nova';
    const len = network === 'erc20' ? 40 : network === 'solana' ? 44 : 38;
    const alpha = network === 'erc20' ? '0123456789abcdef' : 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = prefix;
    for (let i = 0; i < len; i++) s += alpha[Math.floor(rng() * alpha.length)];
    return s;
  }

  _addrPattern(network) {
    const p = ADDR_PREFIX[network] ?? '';
    return new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-zA-Z0-9]{10,}$`);
  }

  list(user) {
    const byUser = { wallets: [], addresses: [] };
    const pick = (rows) => rows; // caller filters by user
    byUser.wallets = this.store.all('wallets', { eq: { user_id: user.id } });
    byUser.addresses = this.store.all('wallet_addresses', { eq: { user_id: user.id } });
    return byUser;
  }

  balances(user) {
    return this.store.all('balances', { eq: { user_id: user.id } });
  }

  /** Deposit request (simulated chain detection in demo). */
  async requestDeposit(user, { asset, network, amountMinor = null, idem }) {
    if (!ASSETS[asset]) throw new WalletError('Unknown asset', 'BAD_ASSET');
    if (!(NETWORKS[asset] ?? []).some((n) => n.id === network)) throw new WalletError('Network not supported for asset', 'BAD_NETWORK');
    await this.ensureWallets(user); // lazily provision wallet + deposit addresses
    const addr = this.store.all('wallet_addresses', { eq: { user_id: user.id, asset, network }, limit: 1 })[0];
    if (!addr) throw new WalletError('No address for network', 'NO_ADDRESS');

    const amt = amountMinor ?? toMinor(asset, '1');
    const dep = await this.store.insert('deposits', {
      id: `DEP-${String(await this.store.nextSeq('deposit')).padStart(5, '0')}`,
      user_id: user.id, asset, network,
      address: addr.address,
      amount: amt,
      status: 'PENDING',
      confirmations: 0,
      tx_hash: null,
      simulated: this.config.demoMode,
      ts: Date.now(),
      updated_at: Date.now(),
    });
    await this.store.insert('transactions', {
      id: crypto.randomUUID(), user_id: user.id, kind: 'DEPOSIT',
      ref_type: 'deposit', ref_id: dep.id, asset, amount: amt,
      status: 'PENDING', meta: { network, simulated: this.config.demoMode }, ts: Date.now(),
    });
    // simulated confirmations (labeled)
    this._after(2500, async () => {
      await this.store.update('deposits', dep.id, { status: 'CONFIRMED', confirmations: 2, tx_hash: this._simHash(dep.id), updated_at: Date.now() });
      await this.store.update('transactions', (await this.store.all('transactions', { eq: { ref_type: 'deposit', ref_id: dep.id }, limit: 1 }))[0]?.id ?? '', { status: 'COMPLETED' }).catch?.(() => {});
      await ledger.ops.deposit(this.store, { uid: user.id, asset, amount: amt, idem: `deposit:${dep.id}`, ref: dep.id });
      await this.notify.send(user.id, { kind: 'deposit', title: 'Deposit confirmed', body: `${toHuman(asset, amt)} ${asset} credited. ${this.config.demoMode ? '(simulated)' : ''}` });
      this.bus?.pushUser(user.id, { type: 'deposit', data: { id: dep.id, status: 'CONFIRMED' } });
    });
    return dep;
  }

  /** Withdrawal request — risk-scored, possibly routed to review/dual approval. */
  async requestWithdrawal(user, { asset, network, address, amountMinor, idem }) {
    if (!ASSETS[asset]) throw new WalletError('Unknown asset', 'BAD_ASSET');
    if (!(NETWORKS[asset] ?? []).some((n) => n.id === network)) throw new WalletError('Network not supported', 'BAD_NETWORK');
    const amt = Number(amountMinor);
    if (!Number.isInteger(amt) || amt <= 0) throw new WalletError('Amount must be a positive whole number of minor units', 'BAD_AMOUNT');
    if (!this._addrPattern(network).test(address)) throw new WalletError('Invalid address format for network', 'BAD_ADDRESS');

    const sys = await this.store.all('system_controls', { limit: 20 });
    if (sys.find((s) => s.key === 'maintenance')?.value === 'true') throw new WalletError('Maintenance mode: withdrawals disabled', 'MAINTENANCE');
    if (sys.find((s) => s.key === 'withdrawals')?.value === 'PAUSED') throw new WalletError('Withdrawals paused by operations', 'WITHDRAWALS_PAUSED');

    const bal = this.store.all('balances', { eq: { user_id: user.id, asset }, limit: 1 })[0];
    if (!bal || bal.available < amt) throw new WalletError('Insufficient available balance', 'INSUFFICIENT_FUNDS');

    const minAmt = toMinor('USDT', String(this.config.policy.minWithdrawalUsdt));
    const usdVal = asset === 'USDT' ? amt : this._approxUsdt(asset, amt);
    if (usdVal < minAmt) throw new WalletError('Below minimum withdrawal', 'MIN_AMOUNT');

    // velocity + destination context (deterministic)
    const hourAgo = Date.now() - this.config.policy.velocityWindowMs;
    const recent = await this.store.all('withdrawals', { eq: { user_id: user.id }, gte: { ts: hourAgo }, limit: 100 });
    const priorToAddress = await this.store.all('withdrawals', { eq: { user_id: user.id, address }, limit: 1 });
    const secSince = Date.now() - this.config.policy.securityChangeWindowMs;
    const recentSec = (await this.store.all('security_events', { eq: { user_id: user.id }, gte: { ts: secSince }, limit: 50 }))
      .filter((e) => ['PASSWORD_CHANGE', '2FA_CHANGE'].includes(e.kind)).length;
    const fails = (await this.store.all('security_events', { eq: { user_id: user.id, success: false }, gte: { ts: Date.now() - 86400e3 }, limit: 50 })).length;

    await ledger.ops.withdrawalReserve(this.store, { uid: user.id, asset, amount: amt, idem: `wd-reserve:${idem ?? crypto.randomUUID()}`, ref: idem ?? null });

    const riskEvent = await this.risk.record({
      type: 'withdrawal', entityType: 'withdrawal', entityId: null, userId: user.id,
      ctx: {
        amountUsdt: Math.round(usdVal / 100),
        withdrawalsInWindow: recent.length,
        isNewDestination: priorToAddress.length === 0,
        recentSecurityChange: recentSec > 0,
        failedAttempts: fails,
      },
      extra: { asset, network, address, amount: amt, usdValue: usdVal },
    });

    const required = usdVal >= toMinor('USDT', String(DUAL_APPROVAL.withdrawalMinUsdt)) ? 2 : 1;
    const wd = await this.store.insert('withdrawals', {
      id: `WD-${String(await this.store.nextSeq('withdrawal')).padStart(5, '0')}`,
      num: await this.store.nextSeq('withdrawal_num'),
      user_id: user.id, asset, network, address,
      amount: amt, fee: this._networkFee(asset, network),
      status: riskEvent.level === 'LOW' && required === 1 ? 'APPROVED' : 'IN_REVIEW',
      risk_level: riskEvent.level,
      risk_event: riskEvent.id,
      verification_status: 'NONE',
      tx_hash: null,
      simulated: this.config.demoMode,
      required_approvals: required,
      approvals: [],
      ts: Date.now(),
      updated_at: Date.now(),
    });
    await this.store.insert('transactions', {
      id: crypto.randomUUID(), user_id: user.id, kind: 'WITHDRAWAL',
      ref_type: 'withdrawal', ref_id: wd.id, asset, amount: amt,
      status: wd.status === 'APPROVED' ? 'PROCESSING' : 'IN_REVIEW',
      meta: { network, address, simulated: this.config.demoMode }, ts: Date.now(),
    });

    if (wd.status === 'APPROVED') {
      this._broadcast(wd);
    } else {
      if (riskEvent.level !== 'LOW') {
        await this.store.insert('manual_reviews', {
          id: crypto.randomUUID(), kind: 'withdrawal', entity_id: wd.id,
          level: riskEvent.level, reason: riskEvent.rules.map((r) => r.id).join(', '),
          status: 'OPEN', assigned_to: null, ts: Date.now(),
        });
        this.bus?.pushOps({ kind: 'withdrawal_review', data: { id: wd.id, level: riskEvent.level, required } });
      }
      await this.notify.send(user.id, {
        kind: 'withdrawal_review', title: 'Withdrawal pending review',
        body: `${toHuman(asset, amt)} ${asset} withdrawal is being reviewed. ${required === 2 ? 'High-value transfers require dual operator approval.' : ''}`,
      });
    }
    return wd;
  }

  _networkFee(asset, network) {
    const fees = { USDT: 1, BTC: 0.0001, ETH: 0.002, SOL: 0.00002, XRP: 0.02, ADA: 0.2, DOGE: 1, AVAX: 0.0001, LINK: 0.002 };
    return toMinor(asset, String(fees[asset] ?? 0.001));
  }

  _approxUsdt(asset, amtMinor) {
    // display-level approximation only (authoritative risk uses stored price snapshot)
    const st = this.config._marketSvc?.markets.get(`${asset}/USDT`);
    if (!st) return amtMinor * 100;
    return (amtMinor * st.last) / 10 ** decimals(asset);
  }

  _simHash(seedStr) {
    let h = 5381;
    for (const c of seedStr) h = (h * 33 + c.charCodeAt(0)) >>> 0;
    return `0xsim${h.toString(16).padStart(8, '0')}${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  }

  _after(ms, fn) {
    const t = setTimeout(async () => {
      this.timers.delete(t);
      try {
        await fn();
      } catch (e) {
        console.error('[wallet] timer action failed', e.message);
      }
    }, ms);
    t.unref?.();
    this.timers.add(t);
  }

  _broadcast(wd) {
    this._after(2000, async () => {
      const cur = await this.store.get('withdrawals', wd.id);
      if (!cur || cur.status !== 'APPROVED') return;
      await this.store.update('withdrawals', cur.id, { status: 'BROADCAST', updated_at: Date.now() });
      this.bus?.pushUser(cur.user_id, { type: 'withdrawal', data: { id: cur.id, status: 'BROADCAST' } });
      this._after(4000, async () => {
        const c2 = await this.store.get('withdrawals', cur.id);
        if (!c2 || c2.status !== 'BROADCAST') return;
        await ledger.ops.withdrawalSettle(this.store, { uid: cur.user_id, asset: cur.asset, amount: cur.amount, idem: `wd-settle:${cur.id}`, ref: cur.id });
        await this.store.update('withdrawals', c2.id, { status: 'CONFIRMED', tx_hash: this._simHash(c2.id), updated_at: Date.now() });
        const tx = (await this.store.all('transactions', { eq: { ref_type: 'withdrawal', ref_id: c2.id }, limit: 1 }))[0];
        if (tx) await this.store.update('transactions', tx.id, { status: 'COMPLETED' });
        await this.notify.send(c2.user_id, { kind: 'withdrawal', title: 'Withdrawal confirmed', body: `${toHuman(c2.asset, c2.amount)} ${c2.asset} sent. ${this.config.demoMode ? '(simulated broadcast)' : ''}` });
        this.bus?.pushUser(c2.user_id, { type: 'withdrawal', data: { id: c2.id, status: 'CONFIRMED' } });
      });
    });
  }

  /** Operator actions on a withdrawal. */
  async operatorAction(wdId, action, { actor, role, reason, approvalId = null }) {
    const wd = await this.store.get('withdrawals', wdId);
    if (!wd) throw new WalletError('Withdrawal not found', 'NOT_FOUND');
    const permMap = {
      review: 'withdrawals:act:review', hold: 'withdrawals:act:hold',
      release: 'withdrawals:act:hold', reject: 'withdrawals:act:reject',
      approve: 'withdrawals:act:review', request_verification: 'withdrawals:act:review',
    };
    const perm = permMap[action];
    if (perm) {
      const { assertCan } = await import('../domain/rbac.js');
      assertCan(role, perm);
    }
    const old = wd.status;

    if (action === 'review') {
      // open/ack — no state change, just audit
      await this.audit.operatorAction({ actor, role, action: 'withdrawal.review', entityType: 'withdrawal', entityId: wdId, reason, result: 'OK', oldState: old, newState: old, approvalId });
      return wd;
    }
    if (action === 'hold') {
      if (!['IN_REVIEW', 'APPROVED'].includes(old)) throw new WalletError(`Cannot hold from ${old}`, 'BAD_STATE');
      await this.store.update('withdrawals', wdId, { status: 'HELD', updated_at: Date.now() });
      await this.audit.operatorAction({ actor, role, action: 'withdrawal.hold', entityType: 'withdrawal', entityId: wdId, reason, result: 'OK', oldState: old, newState: 'HELD', approvalId });
      await this.notify.send(wd.user_id, { kind: 'withdrawal_review', title: 'Withdrawal on hold', body: `Your ${wd.asset} withdrawal is temporarily on hold for review.` });
      return this.store.get('withdrawals', wdId);
    }
    if (action === 'release') {
      if (old !== 'HELD') throw new WalletError(`Cannot release from ${old}`, 'BAD_STATE');
      await this.store.update('withdrawals', wdId, { status: 'IN_REVIEW', updated_at: Date.now() });
      await this.audit.operatorAction({ actor, role, action: 'withdrawal.release', entityType: 'withdrawal', entityId: wdId, reason, result: 'OK', oldState: old, newState: 'IN_REVIEW', approvalId });
      return this.store.get('withdrawals', wdId);
    }
    if (action === 'approve') {
      if (!['IN_REVIEW', 'HELD'].includes(old)) throw new WalletError(`Cannot approve from ${old}`, 'BAD_STATE');
      const approvals = [...wd.approvals.filter((a) => a.by !== actor), { by: actor, role, reason: reason ?? null, ts: Date.now() }];
      if (actor === wd.requested_by) throw new WalletError('Self-approval not allowed', 'SELF_APPROVAL');
      const enough = approvals.length >= wd.required_approvals;
      if (enough) {
        await this.store.update('withdrawals', wdId, { status: 'APPROVED', approvals, updated_at: Date.now() });
        await this.audit.operatorAction({ actor, role, action: 'withdrawal.approve', entityType: 'withdrawal', entityId: wdId, reason, result: 'APPROVED', oldState: old, newState: 'APPROVED', approvalId });
        await this._resolveReview('withdrawal', wdId);
        this._broadcast(await this.store.get('withdrawals', wdId));
      } else {
        await this.store.update('withdrawals', wdId, { approvals, updated_at: Date.now() });
        await this.audit.operatorAction({ actor, role, action: 'withdrawal.approve', entityType: 'withdrawal', entityId: wdId, reason, result: `PENDING (${approvals.length}/${wd.required_approvals})`, oldState: old, newState: old, approvalId });
        this.bus?.pushOps({ kind: 'withdrawal_approval', data: { id: wdId, approved: approvals.length, required: wd.required_approvals } });
      }
      return this.store.get('withdrawals', wdId);
    }
    if (action === 'reject') {
      if (['CONFIRMED', 'BROADCAST', 'REJECTED'].includes(old)) throw new WalletError(`Cannot reject from ${old}`, 'BAD_STATE');
      try {
        await ledger.ops.withdrawalRelease(this.store, { uid: wd.user_id, asset: wd.asset, amount: wd.amount, idem: `wd-reject:${wdId}`, ref: wdId });
      } catch { /* already released */ }
      await this.store.update('withdrawals', wdId, { status: 'REJECTED', updated_at: Date.now() });
      const tx = (await this.store.all('transactions', { eq: { ref_type: 'withdrawal', ref_id: wdId }, limit: 1 }))[0];
      if (tx) await this.store.update('transactions', tx.id, { status: 'REJECTED' });
      await this.audit.operatorAction({ actor, role, action: 'withdrawal.reject', entityType: 'withdrawal', entityId: wdId, reason, result: 'REJECTED', oldState: old, newState: 'REJECTED', approvalId });
      await this.notify.send(wd.user_id, { kind: 'withdrawal_review', title: 'Withdrawal rejected', body: `Your ${wd.asset} withdrawal was rejected: ${reason ?? 'see details'}. Funds returned to available balance.` });
      await this._resolveReview('withdrawal', wdId);
      return this.store.get('withdrawals', wdId);
    }
    if (action === 'request_verification') {
      await this.store.update('withdrawals', wdId, { verification_status: 'PENDING', updated_at: Date.now() });
      await this.audit.operatorAction({ actor, role, action: 'withdrawal.request_verification', entityType: 'withdrawal', entityId: wdId, reason, result: 'OK', oldState: old, newState: old, approvalId });
      await this.notify.send(wd.user_id, { kind: 'withdrawal_review', title: 'Verification requested', body: 'Please confirm this withdrawal is yours in the activity feed.' });
      // simulated user confirmation
      this._after(20_000, async () => {
        const c = await this.store.get('withdrawals', wdId);
        if (c && c.verification_status === 'PENDING') {
          await this.store.update('withdrawals', wdId, { verification_status: 'VERIFIED', updated_at: Date.now() });
          this.bus?.pushOps({ kind: 'withdrawal_verification', data: { id: wdId, status: 'VERIFIED' } });
        }
      });
      return this.store.get('withdrawals', wdId);
    }
    throw new WalletError(`Unknown action ${action}`, 'BAD_ACTION');
  }

  async _resolveReview(kind, entityId) {
    const open = await this.store.all('manual_reviews', { eq: { kind, entity_id: entityId, status: 'OPEN' } });
    for (const r of open) await this.store.update('manual_reviews', r.id, { status: 'RESOLVED', updated_at: Date.now() });
  }

  listOperator(filters = {}) {
    const opts = { order: 'ts', dir: 'desc', limit: Math.min(Number(filters.limit ?? 100), 500) };
    const eq = {};
    if (filters.status) eq.status = filters.status;
    if (filters.risk) eq.risk_level = filters.risk;
    if (filters.user) eq.user_id = filters.user;
    if (filters.num) opts.custom = [(r) => String(r.num).includes(String(filters.num)) || r.id.includes(String(filters.num))];
    if (Object.keys(eq).length) opts.eq = eq;
    const rows = this.store.all('withdrawals', opts);
    const users = new Map(this.store.all('users', { limit: 500 }).map((u) => [u.id, u.email]));
    for (const r of rows) r.user_email = users.get(r.user_id) ?? r.user_id;
    return rows;
  }

  withUser(wdId) {
    const wd = this.store.get('withdrawals', wdId);
    if (!wd) return null;
    const u = this.store.get('users', wd.user_id);
    const risk = wd.risk_event ? this.store.get('risk_events', wd.risk_event) : null;
    return { withdrawal: wd, user: u, riskEvent: risk };
  }
}
