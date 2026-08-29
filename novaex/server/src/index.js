// NOVAEX server bootstrap.
// Wires: store → domain services → API → websocket → market engine → seed.

import { loadConfig } from './config.js';
import { createFileStore, createMemoryStore } from './store/filestore.js';
import { createPostgresStore } from './store/postgres.js';
import { AuditService } from './services/audit.js';
import { NotificationService } from './services/notifications.js';
import { MarketDataService } from './services/marketData.js';
import { TradingService } from './services/trading.js';
import { WalletService } from './services/wallets.js';
import { RiskService } from './services/risk.js';
import { AuthService } from './services/auth.js';
import { UsersService } from './services/users.js';
import { SearchService } from './services/search.js';
import { AIService } from './services/ai.js';
import { SystemService, MarketOpsService, AdjustmentService, ApprovalService } from './services/operator.js';
import { Hub } from './ws.js';
import { createApp } from './api/app.js';
import { runSeed } from './seed.js';

async function createStore(config) {
  if (config.store === 'postgres' && config.databaseUrl) {
    const { readFileSync, existsSync } = await import('node:fs');
    const schemaFile = new URL('./store/schema.sql', import.meta.url).pathname;
    const db = createPostgresStore({ connectionString: config.databaseUrl, schemaFile: existsSync(schemaFile) ? schemaFile : null });
    await db.init();
    console.log('[store] PostgreSQL connected');
    return db;
  }
  if (config.store === 'memory') return createMemoryStore();
  return createFileStore({ file: config.dataFile });
}

export async function createServer({ config = loadConfig(), quiet = false } = {}) {
  const store = await createStore(config);
  const log = quiet ? () => {} : console.log;

  // hub (attached to the express server once listening)
  const hub = new Hub(null, store); // authSvc patched after AuthService

  const audit = new AuditService(store, hub);
  const notify = new NotificationService(store, hub);
  const markets = new MarketDataService(store, { demoMode: config.demoMode });
  const risk = new RiskService(store, hub);
  const auth = new AuthService({ store, config, audit, notify });
  const trading = new TradingService({ store, audit, notify, markets, risk, config });
  const wallets = new WalletService({ store, audit, notify, risk, bus: hub, config });
  const users = new UsersService({ store, markets });
  const search = new SearchService({ store, markets });
  const approvals = new ApprovalService({ store, audit, bus: hub });
  const system = new SystemService({ store, audit, approvals, bus: hub, config });
  const marketOps = new MarketOpsService({ store, audit, approvals, bus: hub });
  const adjustments = new AdjustmentService({ store, audit, approvals, bus: hub, config });
  const ai = new AIService({ store, markets, config, approvals, system, marketOps, audit, bus: hub });

  hub.authSvc = auth;

  // market data hooks
  markets.onTick = async ({ updates }) => {
    hub.pushMarkets(updates);
    await trading.onTick({ updates });
  };
  markets.onSpreadAnomaly = (pair, extra) => {
    risk.record({ type: 'market', entityType: 'market', entityId: pair, ctx: extra }).catch?.(() => {});
  };
  markets.busPush = (uid, payload) => hub.pushUser(uid, payload);

  // approval executors (second-person gated execution)
  const emergencyActions = [
    ['trading_paused', 'trading', 'PAUSED'], ['trading_live', 'trading', 'LIVE'],
    ['maintenance_true', 'maintenance', 'true'], ['maintenance_false', 'maintenance', 'false'],
    ['withdrawals_paused', 'withdrawals', 'PAUSED'], ['withdrawals_enabled', 'withdrawals', 'ENABLED'],
  ];
  for (const [action, key, value] of emergencyActions) {
    approvals.registerExecutor('emergency_control', action, ({ request }) =>
      system.executeControl({ request: { ...request, meta: { key, value } } })
    );
  }
  const marketActions = [['market_paused', 'PAUSED'], ['market_trading', 'TRADING'], ['market_maintenance', 'MAINTENANCE']];
  for (const [action, state] of marketActions) {
    approvals.registerExecutor('market_control', action, ({ request }) =>
      marketOps.executeMarketState({ request: { ...request, meta: { pair: request.target_id, state } } })
    );
  }
  // AI proposals (dual)
  for (const kind of ['PAUSE_MARKET', 'RESUME_MARKET']) {
    approvals.registerExecutor('market_control', `ai_proposal:${kind}`, async ({ request }) => {
      const p = store.get('ai_proposals', request.meta.proposalId);
      if (!p) return null;
      const approver = store.get('users', request.approvals[request.approvals.length - 1]?.by);
      await ai._executeProposal({ id: approver?.id, email: approver?.email, role: 'admin' }, p);
      store.update('ai_proposals', p.id, { status: 'EXECUTED' });
      return { proposal: p.id };
    });
  }
  for (const [kind, key, value] of [
    ['PAUSE_TRADING', 'trading', 'PAUSED'], ['RESUME_TRADING', 'trading', 'LIVE'],
    ['PAUSE_WITHDRAWALS', 'withdrawals', 'PAUSED'], ['RESUME_WITHDRAWALS', 'withdrawals', 'ENABLED'],
    ['MAINTENANCE_ON', 'maintenance', 'true'], ['MAINTENANCE_OFF', 'maintenance', 'false'],
  ]) {
    approvals.registerExecutor('emergency_control', `ai_proposal:${kind}`, async ({ request }) => {
      const p = store.get('ai_proposals', request.meta.proposalId);
      if (!p) return null;
      const approver = store.get('users', request.approvals[request.approvals.length - 1]?.by);
      await ai._executeProposal({ id: approver?.id, email: approver?.email, role: 'admin' }, p);
      store.update('ai_proposals', p.id, { status: 'EXECUTED' });
      return { proposal: p.id };
    });
  }

  const ctx = { store, config, audit, notify, markets, risk, auth, trading, wallets, users, search, approvals, system, marketOps, adjustments, ai };

  // seed demo world when empty
  const hasUsers = store.count('users') > 0;
  if (!hasUsers && (config.seed || config.demoMode)) {
    await markets.seed({ historyDays: 7 });
    markets._seeded = true;
    await runSeed(ctx);
    log(`[seed] demo world ready (SIMULATION) — users: ${['alice@', 'dana@', 'greg@', 'ops@', 'maya@'].join(' ')}novaex.demo`);
  } else if (!hasUsers) {
    await markets.seed({ historyDays: 7 });
  }

  // market engine + sweeps
  markets.start({ intervalMs: 700 });
  const sweeper = setInterval(async () => {
    try {
      approvals.sweep();
    } catch { /* ignore */ }
  }, 60_000);
  sweeper.unref?.();

  const app = createApp({ ...ctx, notifications: notify });
  app.locals.store = store;
  app.locals.auth = auth;
  app.locals.notifications = notify;
  app.locals.search = search;

  const httpServer = await new Promise((resolve, reject) => {
    const s = app.listen(config.port, config.host, () => resolve(s));
    s.once('error', reject);
  });
  hub.attach(httpServer);
  log(`[novaex] listening on http://${config.host}:${config.port} (${config.demoMode ? 'DEMO/SIMULATION' : 'production'}, store=${config.store})`);

  return {
    app, server: httpServer, store, ctx, hub, markets,
    async close() {
      sweeper?.unref?.();
      clearInterval(sweeper);
      markets.stop();
      hub.close();
      store.flush?.();
      await new Promise((r) => httpServer.close(r));
      store.pool?.end?.();
    },
  };
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  createServer()
    .then((srv) => {
      for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { srv.close().then(() => process.exit(0)); });
      process.on('exit', () => srv.store?.flush?.());
    })
    .catch((e) => {
      console.error('fatal:', e);
      process.exit(1);
    });
}
