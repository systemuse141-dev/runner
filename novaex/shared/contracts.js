// NOVAEX shared contracts — single source of truth imported by both the
// server and the web client. Financial amounts are ALWAYS integers in
// asset minor units (e.g. cents for USDT, 1e-8 for BTC). Never floats.

export const ASSETS = {
  USDT: { name: 'Tether USD', decimals: 2, kind: 'fiat-stable', color: '#26A17B' },
  BTC: { name: 'Bitcoin', decimals: 8, kind: 'crypto', color: '#F7931A' },
  ETH: { name: 'Ethereum', decimals: 8, kind: 'crypto', color: '#627EEA' },
  SOL: { name: 'Solana', decimals: 8, kind: 'crypto', color: '#9945FF' },
  XRP: { name: 'XRP', decimals: 6, kind: 'crypto', color: '#00AAE4' },
  ADA: { name: 'Cardano', decimals: 6, kind: 'crypto', color: '#0033AD' },
  DOGE: { name: 'Dogecoin', decimals: 8, kind: 'crypto', color: '#C2A633' },
  AVAX: { name: 'Avalanche', decimals: 6, kind: 'crypto', color: '#E84142' },
  LINK: { name: 'Chainlink', decimals: 8, kind: 'crypto', color: '#2A5ADA' },
};

export const ASSET_DECIMALS = Object.fromEntries(
  Object.entries(ASSETS).map(([k, v]) => [k, v.decimals])
);

export const NETWORKS = {
  USDT: [{ id: 'trc20', name: 'TRON (TRC-20)' }, { id: 'erc20', name: 'Ethereum (ERC-20)' }],
  BTC: [{ id: 'bitcoin', name: 'Bitcoin' }],
  ETH: [{ id: 'erc20', name: 'Ethereum (ERC-20)' }],
  SOL: [{ id: 'solana', name: 'Solana' }],
  XRP: [{ id: 'xrpl', name: 'XRP Ledger' }],
  ADA: [{ id: 'cardano', name: 'Cardano' }],
  DOGE: [{ id: 'doge', name: 'Dogecoin' }],
  AVAX: [{ id: 'avalanche', name: 'Avalanche C-Chain' }],
  LINK: [{ id: 'erc20', name: 'Ethereum (ERC-20)' }],
};

export const MARKET_PAIRS = [
  'BTC/USDT',
  'ETH/USDT',
  'SOL/USDT',
  'XRP/USDT',
  'ADA/USDT',
  'DOGE/USDT',
  'AVAX/USDT',
  'LINK/USDT',
];

export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1D'];

// ---------------------------------------------------------------------------
// Order state machine — the ONLY legal transitions. Any other mutation is a
// bug and must throw. Terminal states can never change again.
// ---------------------------------------------------------------------------

export const ORDER_STATES = [
  'CREATED',
  'VALIDATING',
  'OPEN',
  'PARTIALLY_FILLED',
  'FILLED',
  'CANCEL_REQUESTED',
  'CANCELLED',
  'REJECTED',
  'MANUAL_REVIEW',
];

export const ORDER_TRANSITIONS = {
  CREATED: ['VALIDATING', 'REJECTED', 'CANCELLED'],
  VALIDATING: ['OPEN', 'REJECTED', 'MANUAL_REVIEW', 'CANCELLED'],
  OPEN: ['PARTIALLY_FILLED', 'FILLED', 'CANCEL_REQUESTED', 'MANUAL_REVIEW', 'REJECTED'],
  PARTIALLY_FILLED: ['FILLED', 'CANCEL_REQUESTED', 'MANUAL_REVIEW', 'REJECTED'],
  MANUAL_REVIEW: ['OPEN', 'CANCELLED'],
  CANCEL_REQUESTED: ['CANCELLED', 'OPEN'], // operator may cancel a cancel request (resume)
  FILLED: [],
  CANCELLED: [],
  REJECTED: [],
};

export const ORDER_TERMINAL = new Set(['FILLED', 'CANCELLED', 'REJECTED']);

export const ORDER_TYPES = ['MARKET', 'LIMIT', 'STOP'];
export const ORDER_SIDES = ['BUY', 'SELL'];

// Operator order actions (policy-controlled, audited, validated server-side).
export const ORDER_ACTIONS = [
  'cancel',
  'pause', // OPEN -> MANUAL_REVIEW
  'resume', // MANUAL_REVIEW -> OPEN
  'request_amendment',
  'hold_for_review', // OPEN/PARTIALLY_FILLED -> MANUAL_REVIEW
  'approve_review', // MANUAL_REVIEW -> OPEN
  'reject_review', // MANUAL_REVIEW -> CANCELLED
];

// ---------------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------------
export const WITHDRAWAL_STATES = [
  'REQUESTED',
  'IN_REVIEW',
  'HELD',
  'APPROVED',
  'BROADCAST',
  'CONFIRMED',
  'REJECTED',
  'FAILED',
];
export const WITHDRAWAL_ACTIONS = ['review', 'hold', 'release', 'approve', 'reject', 'request_verification'];

// ---------------------------------------------------------------------------
// Manual balance adjustments: REQUESTED -> REVIEW -> APPROVED -> EXECUTED -> AUDITED
// ---------------------------------------------------------------------------
export const ADJUSTMENT_STATES = ['REQUESTED', 'REVIEW', 'APPROVED', 'EXECUTED', 'AUDITED', 'REJECTED'];

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------
export const APPROVAL_STATES = ['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'CANCELLED', 'EXPIRED'];
export const APPROVAL_SCOPES = [
  'withdrawal',
  'balance_adjustment',
  'order_intervention',
  'market_control',
  'emergency_control',
  'fee_change',
];

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------
export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// ---------------------------------------------------------------------------
// System & market controls
// ---------------------------------------------------------------------------
export const CONTROL_KEYS = ['trading', 'buy', 'sell', 'withdrawals', 'maintenance'];
export const MARKET_STATES = ['TRADING', 'PAUSED', 'MAINTENANCE'];

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------
export const ROLES = ['user', 'trader', 'operator', 'admin'];

export const PERMISSIONS = {
  user: [
    'markets:read',
    'portfolio:read',
    'wallets:own',
    'orders:own',
    'orders:create:market',
    'transactions:own',
    'swaps:own',
    'auth:own',
    'ai:user',
  ],
  trader: [
    'markets:read',
    'portfolio:read',
    'wallets:own',
    'orders:own',
    'orders:create:market',
    'orders:create:limit',
    'orders:create:stop',
    'transactions:own',
    'swaps:own',
    'trades:own',
    'pro:terminal',
    'auth:own',
    'ai:user',
  ],
  operator: [
    'markets:read',
    'ops:read',
    'orders:ops:read',
    'orders:act:cancel',
    'orders:act:pause',
    'orders:act:resume',
    'orders:act:amend',
    'orders:act:hold',
    'orders:act:review',
    'withdrawals:ops:read',
    'withdrawals:act:review',
    'withdrawals:act:hold',
    'withdrawals:act:reject',
    'risk:read',
    'risk:resolve',
    'audit:read',
    'users:ops:read',
    'markets:ops:read',
    'markets:ops:act',
    'system:read',
    'system:act:single',
    'adjustments:create',
    'approvals:read',
    'approvals:act',
    'ai:ops',
  ],
  admin: [
    'markets:read',
    'ops:read',
    'orders:ops:read',
    'orders:act:cancel',
    'orders:act:pause',
    'orders:act:resume',
    'orders:act:amend',
    'orders:act:hold',
    'orders:act:review',
    'withdrawals:ops:read',
    'withdrawals:act:review',
    'withdrawals:act:hold',
    'withdrawals:act:reject',
    'withdrawals:act:approve',
    'risk:read',
    'risk:resolve',
    'audit:read',
    'users:ops:read',
    'markets:ops:read',
    'markets:ops:act',
    'system:read',
    'system:act:single',
    'system:act:dual',
    'adjustments:create',
    'adjustments:act',
    'fees:act',
    'approvals:read',
    'approvals:act',
    'ai:ops',
  ],
};

// Role inheritance: every role also carries the base `user` permissions.
export const ROLE_INHERITANCE = {
  user: ['user'],
  trader: ['user', 'trader'],
  operator: ['user', 'operator'],
  admin: ['user', 'operator', 'admin'],
};

// Actions that ALWAYS require two-person approval (second authorized operator).
export const DUAL_APPROVAL = {
  withdrawalMinUsdt: 50_000, // withdrawal value (USDT) requiring dual approval
  adjustmentHighRiskUsdt: 5_000,
  marketControl: true, // pause/resume of a whole market
  emergencyControl: true, // pause trading / maintenance / pause withdrawals
  feeChange: true,
};

// ---------------------------------------------------------------------------
// Fee schedule (bps = basis points of 1/10,000). Tiers by 30d taker volume.
// ---------------------------------------------------------------------------
export const FEE_TIERS = [
  { id: 'T0', minVolumeUsdt: 0, takerBps: 10, makerBps: 7, label: 'Standard' },
  { id: 'T1', minVolumeUsdt: 50_000, takerBps: 8, makerBps: 5, label: 'Active' },
  { id: 'T2', minVolumeUsdt: 250_000, takerBps: 6, makerBps: 4, label: 'VIP' },
];

// ---------------------------------------------------------------------------
// Policy thresholds (deterministic risk engine inputs)
// ---------------------------------------------------------------------------
export const POLICY = {
  highValueUsdt: 25_000, // withdrawal >= -> HIGH risk
  criticalValueUsdt: 125_000, // withdrawal >= -> CRITICAL risk
  velocityWindowMs: 60 * 60 * 1000, // 1h
  velocityMedium: 3, // withdrawals in window
  velocityHigh: 5,
  securityChangeWindowMs: 72 * 60 * 60 * 1000,
  failedAttemptsThreshold: 3,
  orderAnomalyMultiplier: 5, // vs own 30d average order notional
  orderAnomalyCriticalMultiplier: 20,
  orderAnomalyMinUsdt: 1_000,
  minOrderNotionalUsdt: 10,
  minWithdrawalUsdt: 5,
  proposalTtlMs: 10 * 60 * 1000,
  sessionTtlMs: 12 * 60 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// WebSocket topics
// ---------------------------------------------------------------------------
export const WS_TOPICS = {
  MARKETS: 'mkt',
  USER: (uid) => `user:${uid}`,
  OPS: 'ops',
};

// Append-only tables: the store must refuse update/delete on these.
export const APPEND_ONLY_TABLES = new Set([
  'audit_logs',
  'ledger_entries',
  'ledger_operations',
  'order_events',
  'order_fills',
  'trades',
  'security_events',
  'notifications',
]);

export const TABLES = [
  'users', 'profiles', 'roles', 'permissions', 'sessions', 'assets', 'networks',
  'markets', 'wallets', 'wallet_addresses', 'balances', 'ledger_accounts',
  'ledger_entries', 'ledger_operations', 'orders', 'order_events', 'order_fills',
  'trades', 'transactions', 'deposits', 'withdrawals', 'swaps', 'fees',
  'risk_events', 'manual_reviews', 'approval_requests', 'operator_actions',
  'notifications', 'audit_logs', 'system_controls', 'market_controls',
  'security_events', 'balance_adjustments', 'ai_proposals', 'idempotency',
];
