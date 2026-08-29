// Express app assembly: versioned API /api/v1/*, security middleware,
// static web build, /health.

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  securityHeaders, cors, requireAuth, rateLimit, csrf, idempotency, bodyHash, errorHandler, notFound,
} from '../middleware/index.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/user.js';
import { operatorRoutes } from './routes/operator.js';
import { aiRoutes } from './routes/ai.js';
import { approvalsRoutes, auditRoutes } from './routes/approvals.js';

export function createApp(ctx) {
  const app = express();
  app.disable('x-powered-by');
  // honor X-Forwarded-For from direct (loopback) connections — e.g. tests and local proxies
  app.set('trust proxy', 'loopback');
  app.use(securityHeaders);
  app.use(cors(ctx.config));
  app.use(express.json({ limit: '256kb' }));
  app.use(bodyHash);

  app.get('/health', (req, res) => {
    res.json({ ok: true, mode: ctx.config.demoMode ? 'demo-simulation' : 'production', demo: ctx.config.demoMode, ts: Date.now() });
  });

  // rate limits
  app.use('/api/', rateLimit({ max: ctx.config.rateLimits.generalPerMin, windowMs: 60_000, keyFn: (req) => `${req.ip}:api` }));
  app.use('/api/v1/auth/login', rateLimit({ max: ctx.config.rateLimits.authPerMin, windowMs: 60_000, keyFn: (req) => `${req.ip}:auth`, message: 'Too many login attempts. Try again in a minute.' }));

  const auth = requireAuth(ctx.auth);

  // --- auth (public) ---
  app.use('/api/v1/auth', authRoutes(ctx));

  // --- authenticated ---
  app.use('/api/v1', auth, csrf(), idempotency(ctx.store), userRoutes(ctx));
  app.use('/api/v1/operator', operatorRoutes(ctx));
  app.use('/api/v1/ai', aiRoutes(ctx));
  app.use('/api/v1/approvals', approvalsRoutes(ctx));
  app.use('/api/v1/audit', auditRoutes(ctx));

  // --- static web app ---
  const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public');
  app.use(express.static(publicDir, { index: 'index.html', maxAge: '1h' }));
  app.get(/^(?!\/(api|ws)).*/, (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'), (err) => {
      if (err) notFound(res);
    });
  });

  app.use('/api', notFound);
  app.use(errorHandler());
  return app;
}
