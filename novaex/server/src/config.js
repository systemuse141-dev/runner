import { DUAL_APPROVAL, POLICY } from '../../shared/contracts.js';

export function loadConfig(env = process.env) {
  return {
    env: env.NODE_ENV ?? 'development',
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    // DEMO_MODE: simulated market data + execution + blockchain. Always true
    // unless a real ExecutionProvider/BlockchainProvider is configured.
    demoMode: env.DEMO_MODE !== 'false',
    store: env.STORE ?? (env.DATABASE_URL ? 'postgres' : 'file'),
    databaseUrl: env.DATABASE_URL ?? null,
    dataFile: env.NOVAEX_DATA ?? new URL('../data/demo.db.json', import.meta.url).pathname,
    seed: env.NOVAEX_DEMO_SEED === '1' || env.NOVAEX_DEMO_SEED === 'auto',
    sessionSecret: env.NOVAEX_SESSION_SECRET ?? 'novaex-dev-session-secret-change-me',
    policy: {
      ...POLICY,
      ...DUAL_APPROVAL,
    },
    rateLimits: {
      generalPerMin: Number(env.RATE_LIMIT_GENERAL ?? 240),
      authPerMin: Number(env.RATE_LIMIT_AUTH ?? 12),
      withdrawPerMin: Number(env.RATE_LIMIT_WITHDRAW ?? 10),
    },
    corsOrigins: (env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
  };
}
