// Auditable double-entry ledger.
//
// Accounts:
//   user:{uid}:{asset}:avail   customer available balance   (must stay >= 0)
//   user:{uid}:{asset}:resv    customer reserved balance    (must stay >= 0)
//   house:{asset}              exchange custody pool (may be negative = owed)
//   fees:{asset}               accrued fee revenue          (must stay >= 0)
//
// Every operation writes entries whose signed amounts sum to exactly zero.
// Balances are DERIVED from entries; a materialized cache is kept in the same
// transaction and can be verified with reconcile().

export class LedgerError extends Error {
  constructor(msg, code) {
    super(msg);
    this.name = 'LedgerError';
    this.code = code ?? 'LEDGER_ERROR';
    this.status = 500;
  }
}

export const acct = {
  avail: (uid, asset) => `user:${uid}:${asset}:avail`,
  resv: (uid, asset) => `user:${uid}:${asset}:resv`,
  house: (asset) => `house:{asset}`,
  fees: (asset) => `fees:${asset}`,
};

const USER_PREFIX = 'user:';
const FEE_PREFIX = 'fees:';

/** Validate + apply a set of ledger entries inside one transaction.
 *  - entries must sum to exactly zero
 *  - user/fees accounts must never go negative
 *  - idempotency keys are replay-safe
 */
export function applyEntries(store, { operation, ref, idempotencyKey, entries, memo = '' }) {
  if (idempotencyKey) {
    const prior = store.all('ledger_operations', { eq: { idempotency_key: idempotencyKey, operation }, limit: 1 })[0];
    if (prior) return { replayed: true, op: prior };
  }

  if (!Array.isArray(entries) || entries.length < 2) throw new LedgerError('Need at least two entries', 'BAD_OP');

  const sum = entries.reduce((s, e) => s + e.amount, 0);
  if (sum !== 0) throw new LedgerError('Entries must sum to zero (double-entry)', 'UNBALANCED');

  const deltas = new Map();
  for (const e of entries) deltas.set(e.account, (deltas.get(e.account) ?? 0) + e.amount);
  for (const [account, delta] of deltas) {
    if (account.startsWith(USER_PREFIX) || account.startsWith(FEE_PREFIX)) {
      const cur = accountBalance(store, account);
      if (cur + delta < 0) {
        throw new LedgerError(`Insufficient balance on ${account} (${cur} + ${delta})`, 'INSUFFICIENT_FUNDS');
      }
    }
  }

  const ts = Date.now();
  const op = store.insert('ledger_operations', {
    id: opId(store, operation),
    operation,
    ref: ref ?? null,
    idempotency_key: idempotencyKey ?? null,
    memo,
    ts,
  });

  for (const e of entries) {
    store.insert('ledger_entries', {
      id: crypto.randomUUID(),
      op_id: op.id,
      account: e.account,
      asset: e.asset,
      amount: e.amount,
      ts,
    });
    upsertBalance(store, e.account, e.amount);
  }
  return { replayed: false, op };
}

function opId(store, operation) {
  const seq = store.nextSeq(`ledger_${operation}`);
  return `OP-${operation}-${String(seq).padStart(6, '0')}`;
}

/** Derived balance of one account from its entries (source of truth). */
export function accountBalance(store, account) {
  const entries = store.all('ledger_entries', { eq: { account }, limit: 100_000 });
  return entries.reduce((s, e) => s + e.amount, 0);
}

function upsertBalance(store, account, delta) {
  const parts = account.split(':');
  let uid = null, asset = null, balKind = null, ownerType = 'house';
  if (parts[0] === 'user') {
    [uid, asset, balKind] = [parts[1], parts[2], parts[3]];
    ownerType = 'user';
  } else if (parts[0] === 'fees') {
    asset = parts[1];
    ownerType = 'fees';
  } else {
    asset = parts[1];
    ownerType = 'house';
  }

  let row = store.all('ledger_accounts', { eq: { account }, limit: 1 })[0];
  if (!row) {
    row = store.insert('ledger_accounts', {
      id: crypto.randomUUID(),
      account,
      owner_type: ownerType,
      owner_id: uid ?? `${ownerType}:${asset}`,
      asset,
      balance: 0,
    });
  }
  store.update('ledger_accounts', row.id, { balance: row.balance + delta });

  if (uid && (balKind === 'avail' || balKind === 'resv')) {
    let bal = store.all('balances', { eq: { user_id: uid, asset }, limit: 1 })[0];
    if (!bal) bal = store.insert('balances', { id: crypto.randomUUID(), user_id: uid, asset, available: 0, reserved: 0 });
    const patch = {};
    if (balKind === 'avail') patch.available = bal.available + delta;
    else patch.reserved = bal.reserved + delta;
    store.update('balances', bal.id, patch);
  }
}

/** Standard operation builders (each sums to zero). */
export const ops = {
  /** Chain deposit credited to customer. */
  deposit(store, { uid, asset, amount, idem, ref }) {
    return applyEntries(store, {
      operation: 'DEPOSIT', ref, idempotencyKey: idem,
      entries: [
        { account: acct.avail(uid, asset), asset, amount },
        { account: acct.house(asset), asset, amount: -amount },
      ],
      memo: 'Deposit credit',
    });
  },

  /** Instant taker fill: market buy/sell with fee in quote. */
  marketFill(store, { uid, base, quote, qty, notional, fee, side, idem, ref }) {
    const entries =
      side === 'BUY'
        ? [
            { account: acct.avail(uid, quote), asset: quote, amount: -notional },
            { account: acct.house(quote), asset: quote, amount: notional },
            { account: acct.avail(uid, base), asset: base, amount: qty },
            { account: acct.house(base), asset: base, amount: -qty },
          ]
        : [
            { account: acct.avail(uid, base), asset: base, amount: -qty },
            { account: acct.house(base), asset: base, amount: qty },
            { account: acct.avail(uid, quote), asset: quote, amount: notional },
            { account: acct.house(quote), asset: quote, amount: -notional },
          ];
    if (fee > 0) {
      entries.push({ account: acct.avail(uid, quote), asset: quote, amount: -fee });
      entries.push({ account: acct.fees(quote), asset: quote, amount: fee });
    }
    return applyEntries(store, { operation: 'FILL', ref, idempotencyKey: idem, entries, memo: `Market fill ${side}` });
  },

  /** Reserve funds to open a resting order. */
  reserveForOrder(store, { uid, asset, amount, idem, ref }) {
    return applyEntries(store, {
      operation: 'RESERVE', ref, idempotencyKey: idem,
      entries: [
        { account: acct.avail(uid, asset), asset, amount: -amount },
        { account: acct.resv(uid, asset), asset, amount },
      ],
      memo: 'Order reservation',
    });
  },

  /** Release an unexecuted reservation (cancel/reject). */
  unreserve(store, { uid, asset, amount, idem, ref }) {
    return applyEntries(store, {
      operation: 'UNRESERVE', ref, idempotencyKey: idem,
      entries: [
        { account: acct.resv(uid, asset), asset, amount: -amount },
        { account: acct.avail(uid, asset), asset, amount },
      ],
      memo: 'Reservation released',
    });
  },

  /** Maker (limit) fill consuming a reservation. */
  makerFill(store, { uid, base, quote, notional, qty, fee, side, idem, ref }) {
    const entries =
      side === 'BUY'
        ? [
            // reservation held notional + fee in quote
            { account: acct.resv(uid, quote), asset: quote, amount: -(notional + fee) },
            { account: acct.house(quote), asset: quote, amount: notional },
            { account: acct.fees(quote), asset: quote, amount: fee },
            { account: acct.avail(uid, base), asset: base, amount: qty },
            { account: acct.house(base), asset: base, amount: -qty },
          ]
        : [
            // reservation held base qty
            { account: acct.resv(uid, base), asset: base, amount: -qty },
            { account: acct.house(base), asset: base, amount: qty },
            { account: acct.avail(uid, quote), asset: quote, amount: notional - fee },
            { account: acct.house(quote), asset: quote, amount: -(notional - fee) },
            { account: acct.fees(quote), asset: quote, amount: fee },
            { account: acct.avail(uid, quote), asset: quote, amount: -fee },
          ];
    return applyEntries(store, { operation: 'FILL', ref, idempotencyKey: idem, entries, memo: `Maker fill ${side}` });
  },

  /** Withdrawal settlement (funds already moved to reserved at request time). */
  withdrawalSettle(store, { uid, asset, amount, idem, ref }) {
    return applyEntries(store, {
      operation: 'WITHDRAWAL', ref, idempotencyKey: idem,
      entries: [
        { account: acct.resv(uid, asset), asset, amount: -amount },
        { account: acct.house(asset), asset, amount: amount },
      ],
      memo: 'Withdrawal settlement',
    });
  },

  /** Release a reservation back to available (withdrawal rejected/held). */
  withdrawalRelease(store, { uid, asset, amount, idem, ref }) {
    return applyEntries(store, {
      operation: 'UNRESERVE', ref, idempotencyKey: idem,
      entries: [
        { account: acct.resv(uid, asset), asset, amount: -amount },
        { account: acct.avail(uid, asset), asset, amount },
      ],
      memo: 'Withdrawal funds released',
    });
  },

  /** Reserve for withdrawal (available -> reserved). */
  withdrawalReserve(store, { uid, asset, amount, idem, ref }) {
    return applyEntries(store, {
      operation: 'RESERVE', ref, idempotencyKey: idem,
      entries: [
        { account: acct.avail(uid, asset), asset, amount: -amount },
        { account: acct.resv(uid, asset), asset, amount },
      ],
      memo: 'Withdrawal reservation',
    });
  },

  /** Manual balance adjustment (exchange grants or claws back). */
  adjustment(store, { uid, asset, delta, idem, ref }) {
    return applyEntries(store, {
      operation: 'ADJUSTMENT', ref, idempotencyKey: idem,
      entries: [
        { account: acct.avail(uid, asset), asset, amount: delta },
        { account: acct.house(asset), asset, amount: -delta },
      ],
      memo: 'Manual balance adjustment',
    });
  },
};

/** Verify materialized balances against the derived ledger (audit tool). */
export function reconcile(store) {
  const drift = [];
  const accounts = store.all('ledger_accounts', { eq: { owner_type: 'user' }, limit: 100_000 });
  for (const a of accounts) {
    const derived = accountBalance(store, a.account);
    if (derived !== a.balance) drift.push({ account: a.account, stored: a.balance, derived });
  }
  const cache = store.all('balances', { limit: 100_000 });
  for (const b of cache) {
    const avail = accountBalance(store, acct.avail(b.user_id, b.asset));
    const resv = accountBalance(store, acct.resv(b.user_id, b.asset));
    if (avail !== b.available || resv !== b.reserved)
      drift.push({ account: `balances:${b.user_id}:${b.asset}`, stored: { available: b.available, reserved: b.reserved }, derived: { available: avail, reserved: resv } });
  }
  return drift;
}
