-- NOVAEX PostgreSQL schema (production mode).
-- All monetary values are NUMERIC (never floating point).
-- Append-only tables are protected by triggers in production deployments
-- and by application-level enforcement in this codebase.

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email CITEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  totp_secret TEXT,
  account_status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at BIGINT NOT NULL,
  updated_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  full_name TEXT,
  locale TEXT,
  theme TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  role_name TEXT NOT NULL,
  permission TEXT NOT NULL,
  UNIQUE (role_name, permission)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  csrf TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT,
  expires_at BIGINT NOT NULL,
  revoked_at BIGINT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,          -- asset symbol
  name TEXT NOT NULL,
  decimals SMALLINT NOT NULL,
  kind TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS networks (
  id TEXT PRIMARY KEY,          -- {asset}:{network}
  asset TEXT NOT NULL,
  name TEXT NOT NULL,
  deposit_confirms INT NOT NULL DEFAULT 2
);

CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY,          -- pair e.g. BTC/USDT
  base TEXT NOT NULL,
  quote TEXT NOT NULL,
  min_notional NUMERIC(36,8) NOT NULL,
  tick_size NUMERIC(36,12) NOT NULL,
  state TEXT NOT NULL DEFAULT 'TRADING',
  updated_at BIGINT
);

CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  asset TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (user_id, asset)
);

CREATE TABLE IF NOT EXISTS wallet_addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  address TEXT NOT NULL,
  simulated BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  UNIQUE (user_id, asset, network)
);

CREATE TABLE IF NOT EXISTS balances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  available NUMERIC(36,8) NOT NULL DEFAULT 0,
  reserved NUMERIC(36,8) NOT NULL DEFAULT 0,
  UNIQUE (user_id, asset)
);
CREATE INDEX IF NOT EXISTS idx_balances_user ON balances (user_id);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id TEXT PRIMARY KEY,
  account TEXT UNIQUE NOT NULL,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  balance NUMERIC(36,8) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ledger_operations (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  ref TEXT,
  idempotency_key TEXT UNIQUE,
  memo TEXT,
  ts BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_ops_ref ON ledger_operations (ref);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  op_id TEXT NOT NULL REFERENCES ledger_operations(id),
  account TEXT NOT NULL,
  asset TEXT NOT NULL,
  amount NUMERIC(36,8) NOT NULL,
  ts BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON ledger_entries (account);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_op ON ledger_entries (op_id);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  num BIGINT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  pair TEXT NOT NULL,
  base TEXT NOT NULL,
  quote TEXT NOT NULL,
  side TEXT NOT NULL,
  type TEXT NOT NULL,
  state TEXT NOT NULL,
  price NUMERIC(36,12),
  stop_price NUMERIC(36,12),
  qty NUMERIC(36,8) NOT NULL,
  quote_amount NUMERIC(36,8),
  filled NUMERIC(36,8) NOT NULL DEFAULT 0,
  quote_filled NUMERIC(36,8) NOT NULL DEFAULT 0,
  avg_price NUMERIC(36,12),
  fee NUMERIC(36,8) NOT NULL DEFAULT 0,
  fee_asset TEXT,
  risk_level TEXT NOT NULL DEFAULT 'LOW',
  risk_events JSONB,
  amendment_requested BOOLEAN NOT NULL DEFAULT FALSE,
  swap BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_pair ON orders (pair);
CREATE INDEX IF NOT EXISTS idx_orders_state ON orders (state);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at);

CREATE TABLE IF NOT EXISTS order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  from_state TEXT,
  to_state TEXT NOT NULL,
  actor TEXT NOT NULL,
  actor_role TEXT,
  reason TEXT,
  meta JSONB,
  ts BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events (order_id);

CREATE TABLE IF NOT EXISTS order_fills (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  price NUMERIC(36,12) NOT NULL,
  qty NUMERIC(36,8) NOT NULL,
  fee NUMERIC(36,8) NOT NULL,
  side TEXT NOT NULL,
  maker_taker TEXT NOT NULL,
  ts BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  order_id TEXT,
  pair TEXT NOT NULL,
  side TEXT NOT NULL,
  price NUMERIC(36,12) NOT NULL,
  qty NUMERIC(36,8) NOT NULL,
  notional NUMERIC(36,8) NOT NULL,
  fee NUMERIC(36,8) NOT NULL,
  fee_asset TEXT,
  maker_taker TEXT NOT NULL,
  ts BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades (user_id, ts);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,           -- DEPOSIT | WITHDRAWAL | TRADE | SWAP
  ref_type TEXT,
  ref_id TEXT,
  asset TEXT,
  amount NUMERIC(36,8),
  status TEXT NOT NULL,
  meta JSONB,
  ts BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions (user_id, ts);

CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  address TEXT NOT NULL,
  amount NUMERIC(36,8),
  status TEXT NOT NULL DEFAULT 'PENDING',
  confirmations INT NOT NULL DEFAULT 0,
  tx_hash TEXT,
  simulated BOOLEAN NOT NULL DEFAULT TRUE,
  ts BIGINT NOT NULL,
  updated_at BIGINT
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  num BIGINT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  address TEXT NOT NULL,
  amount NUMERIC(36,8) NOT NULL,
  fee NUMERIC(36,8) NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'LOW',
  risk_event TEXT,
  verification_status TEXT NOT NULL DEFAULT 'NONE',
  tx_hash TEXT,
  simulated BOOLEAN NOT NULL DEFAULT TRUE,
  required_approvals INT NOT NULL DEFAULT 1,
  approvals JSONB,
  ts BIGINT NOT NULL,
  updated_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals (user_id, ts);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals (status);

CREATE TABLE IF NOT EXISTS swaps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  from_asset TEXT NOT NULL,
  to_asset TEXT NOT NULL,
  from_amount NUMERIC(36,8) NOT NULL,
  to_amount NUMERIC(36,8) NOT NULL,
  rate NUMERIC(36,12) NOT NULL,
  fee NUMERIC(36,8) NOT NULL,
  status TEXT NOT NULL,
  ts BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS fees (
  id TEXT PRIMARY KEY,
  tier_id TEXT NOT NULL,
  min_volume NUMERIC(36,8) NOT NULL,
  taker_bps INT NOT NULL,
  maker_bps INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  ts BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS risk_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  user_id TEXT,
  level TEXT NOT NULL,
  score INT NOT NULL,
  rules JSONB NOT NULL,
  data JSONB,
  status TEXT NOT NULL DEFAULT 'OPEN',
  resolved_by TEXT,
  ts BIGINT NOT NULL,
  updated_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_risk_status ON risk_events (status, level);
CREATE INDEX IF NOT EXISTS idx_risk_entity ON risk_events (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS manual_reviews (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,           -- order | withdrawal | adjustment
  entity_id TEXT NOT NULL,
  level TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  assigned_to TEXT,
  ts BIGINT NOT NULL,
  updated_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON manual_reviews (status);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  requested_by TEXT NOT NULL,
  requested_role TEXT,
  reason TEXT,
  meta JSONB,
  required_approvals INT NOT NULL DEFAULT 1,
  approvals JSONB NOT NULL DEFAULT '[]',
  rejections JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  executed_by TEXT,
  execution_result JSONB,
  ts BIGINT NOT NULL,
  expires_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approval_requests (status);

CREATE TABLE IF NOT EXISTS operator_actions (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  reason TEXT,
  result TEXT,
  approval_id TEXT,
  ts BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_op_actions_actor ON operator_actions (actor, ts);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  ts BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications (user_id, ts);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  old_state JSONB,
  new_state JSONB,
  reason TEXT,
  request_meta JSONB,
  approval_id TEXT,
  ts BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs (ts);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action);

CREATE TABLE IF NOT EXISTS system_controls (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_by TEXT,
  reason TEXT,
  approval_id TEXT,
  ts BIGINT NOT NULL,
  UNIQUE (key)
);

CREATE TABLE IF NOT EXISTS market_controls (
  id TEXT PRIMARY KEY,
  pair TEXT NOT NULL,
  state TEXT NOT NULL,
  reason TEXT,
  updated_by TEXT,
  approval_id TEXT,
  ts BIGINT NOT NULL,
  UNIQUE (pair)
);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  success BOOLEAN NOT NULL,
  ts BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_user ON security_events (user_id, ts);

CREATE TABLE IF NOT EXISTS balance_adjustments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  delta NUMERIC(36,8) NOT NULL,
  reason TEXT NOT NULL,
  reference TEXT,
  evidence JSONB,
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  requested_by TEXT NOT NULL,
  required_approvals INT NOT NULL DEFAULT 1,
  approvals JSONB NOT NULL DEFAULT '[]',
  executed_by TEXT,
  ts BIGINT NOT NULL,
  updated_at BIGINT
);

CREATE TABLE IF NOT EXISTS ai_proposals (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  reason TEXT,
  scope TEXT,
  impact TEXT,
  risk TEXT,
  required_approvals INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_by TEXT,
  approval_id TEXT,
  ts BIGINT NOT NULL,
  expires_at BIGINT
);

CREATE TABLE IF NOT EXISTS idempotency (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  key TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  result JSONB,
  status INT,
  ts BIGINT NOT NULL,
  UNIQUE (user_id, key)
);

-- Production guardrails: block UPDATE/DELETE on append-only tables.
-- (Application code also enforces this on every store.)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_logs','ledger_entries','ledger_operations','order_events','order_fills','trades','security_events','notifications']
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE FUNCTION no_mutation_%I() RETURNS trigger AS $$
       BEGIN RAISE EXCEPTION ''% is append-only''; END $$ LANGUAGE plpgsql;',
      t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS ai_%1$s_no_update ON %1$s;', t);
    EXECUTE format(
      'CREATE TRIGGER ai_%1$s_no_update BEFORE UPDATE OR DELETE ON %1$s
       FOR EACH ROW EXECUTE FUNCTION no_mutation_%1$s();', t);
  END LOOP;
END $$;
