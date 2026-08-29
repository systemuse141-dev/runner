// API middleware: security headers, session auth, RBAC, rate limiting,
// CSRF double-submit, idempotency, error normalization.

import { createHash } from 'node:crypto';
import { can } from '../domain/rbac.js';

export function parseCookie(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
}

export function cors(config) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && config.corsOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, Idempotency-Key');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  };
}

/** Session authentication from httpOnly cookie. */
export function requireAuth(authSvc) {
  return (req, res, next) => {
    const sid = parseCookie(req.headers.cookie).nx_sid;
    const session = sid ? authSvc.sessionForCookie(sid) : null;
    if (!session) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } });
      return;
    }
    const user = req.app.locals.store.get('users', session.user_id);
    if (!user) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Account unavailable.' } });
      return;
    }
    req.user = user;
    req.session = session;
    next();
  };
}

/** RBAC gate. */
export function requirePerm(perm) {
  return (req, res, next) => {
    if (!can(req.user.role, perm)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: `Requires permission "${perm}".` } });
      return;
    }
    next();
  };
}

/** Roles gate (mode access). */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have access to this area.' } });
      return;
    }
    next();
  };
}

/** Sliding-window in-memory rate limiter. */
export function rateLimit({ windowMs = 60_000, max = 60, keyFn, message = 'Too many requests.' }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, arr] of hits) if (!arr.length || arr[0] < now - windowMs) hits.delete(k);
  }, 60_000).unref?.();
  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : `${req.ip}:${req.path}`;
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
      return;
    }
    arr.push(now);
    hits.set(key, arr);
    next();
  };
}

/** CSRF: double-submit cookie for mutating requests. */
export function csrf() {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const cookies = parseCookie(req.headers.cookie);
    const token = req.headers['x-csrf-token'];
    if (!cookies.nx_csrf || !token || cookies.nx_csrf !== token) {
      res.status(403).json({ error: { code: 'CSRF', message: 'CSRF token mismatch.' } });
      return;
    }
    next();
  };
}

/** Idempotency: replay identical POSTs with the same key. */
export function idempotency(store) {
  return (req, res, next) => {
    if (req.method !== 'POST') return next();
    const key = req.headers['idempotency-key'];
    if (!key || !req.user) return next();
    const idemKey = `${req.user.id}:${key}`;
    const prior = store.all('idempotency', { eq: { key: idemKey }, limit: 1 })[0];
    if (prior) {
      if (prior.body_hash !== req.app.locals.bodyHash) {
        res.status(409).json({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Key reused with a different body.' } });
        return;
      }
      res.status(prior.status ?? 200).json(prior.result);
      return;
    }
    const origJson = res.json.bind(res);
    res.json = (payload) => {
      if (!store.all('idempotency', { eq: { key: idemKey }, limit: 1 }).length) {
        store.insert('idempotency', {
          id: crypto.randomUUID(), user_id: req.user.id, key: idemKey,
          body_hash: req.app.locals.bodyHash ?? null,
          result: payload, status: res.statusCode, ts: Date.now(),
        });
      }
      return origJson(payload);
    };
    next();
  };
}

/** Compute body hash for idempotency. */
export function bodyHash(req, res, next) {
  req.app.locals.bodyHash = req.body && typeof req.body === 'object'
    ? createHash('sha256').update(JSON.stringify(req.body)).digest('hex')
    : null;
  next();
}

/** Normalize errors to { error: { code, message } }. */
export function errorHandler() {
  return (err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'BAD_JSON', message: 'Invalid JSON body.' } });
      return;
    }
    const status = err.status ?? (err.code === 'FORBIDDEN' ? 403 : err.code === 'NOT_FOUND' ? 404 : 500);
    if (status >= 500) console.error('[api]', err);
    res.status(status).json({
      error: { code: err.code ?? 'INTERNAL', message: status >= 500 ? 'Internal error.' : err.message },
    });
  };
}

export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
}
