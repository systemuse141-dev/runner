import { Router } from 'express';
import { hashPassword } from '../../services/auth.js';
import { requireAuth, parseCookie } from '../../middleware/index.js';

export function authRoutes(ctx) {
  const { auth, store, config } = ctx;
  const r = Router();
  const authed = requireAuth(ctx.auth);

  r.post('/register', async (req, res, next) => {
    try {
      const user = await auth.register(req.body);
      const session = await store.insert('sessions', {
        id: crypto.randomUUID(), user_id: user.id,
        csrf: (await import('node:crypto')).randomBytes(24).toString('hex'),
        user_agent: req.headers['user-agent'] ?? null, ip: req.ip,
        expires_at: Date.now() + config.policy.sessionTtlMs,
        revoked_at: null, created_at: Date.now(),
      });
      _setSession(res, session, config);
      res.json({ user: auth.safeUser(user), session: true });
    } catch (e) {
      next(e);
    }
  });

  r.post('/login', async (req, res, next) => {
    try {
      const out = await auth.login({ ...req.body, ip: req.ip });
      if (out.needs2fa) {
        // short-lived pending session (not httpOnly-full — still cookie but not usable until 2FA)
        res.json({ needs2fa: true, sessionId: out.sessionId });
        return;
      }
      _setSession(res, out.session, config);
      res.json({ user: out.user });
    } catch (e) {
      next(e);
    }
  });

  r.post('/2fa/complete', async (req, res, next) => {
    try {
      const sid = req.body?.sessionId;
      const pending = sid ? store.get('sessions', sid) : null;
      if (!pending || !pending.pending_2fa) throw Object.assign(new Error('Invalid 2FA session.'), { code: 'BAD_SESSION', status: 401 });
      const out = await auth.complete2fa(sid, req.body.code);
      await store.update('sessions', sid, { pending_2fa: false });
      _setSession(res, { ...pending, pending_2fa: false }, config);
      res.json({ user: out.user });
    } catch (e) {
      next(e);
    }
  });

  r.post('/logout', async (req, res) => {
    const sid = req.session?.id ?? parseCookie(req.headers.cookie ?? '').nx_sid;
    if (sid) await auth.logout(sid);
    res.clearCookie('nx_sid');
    res.clearCookie('nx_csrf');
    res.json({ ok: true });
  });

  r.get('/sessions', authed, (req, res) => {
    res.json({ sessions: auth.listSessions(req.user.id).map((s) => ({
      id: s.id, created_at: s.created_at, expires_at: s.expires_at,
      user_agent: s.user_agent, ip: s.ip, current: s.id === req.session.id, revoked: !!s.revoked_at,
    })) });
  });

  r.delete('/sessions/:id', authed, async (req, res, next) => {
    try {
      await auth.revokeSession(req.user.id, req.params.id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  r.post('/password', authed, async (req, res, next) => {
    try {
      await auth.changePassword(req.user, req.body);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  r.post('/2fa/setup', authed, (req, res) => {
    res.json(auth.setup2fa(req.user));
  });

  r.post('/2fa/enable', authed, async (req, res, next) => {
    try {
      const { code } = req.body;
      const { secret } = req.body;
      const user = store.get('users', req.user.id);
      if (user.totp_secret) throw Object.assign(new Error('2FA already enabled.'), { code: 'ALREADY', status: 409 });
      // temp-bind the secret: enable uses the just-generated secret
      await store.update('users', req.user.id, { totp_secret: null });
      const { verifyTotp } = await import('../../domain/totp.js');
      if (!verifyTotp(secret, code)) throw Object.assign(new Error('Invalid 2FA code.'), { code: 'BAD_2FA', status: 401 });
      await store.update('users', req.user.id, { totp_secret: secret });
      req.app.locals.auth.securityEvent(req.user.id, '2FA_CHANGE', { detail: '2FA enabled' });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  r.post('/2fa/disable', authed, async (req, res, next) => {
    try {
      const user = store.get('users', req.user.id);
      const { verifyTotp } = await import('../../domain/totp.js');
      if (!user.totp_secret) throw Object.assign(new Error('2FA is not enabled.'), { code: 'NO_2FA', status: 400 });
      if (!verifyTotp(user.totp_secret, req.body.code)) throw Object.assign(new Error('Invalid 2FA code.'), { code: 'BAD_2FA', status: 401 });
      await store.update('users', req.user.id, { totp_secret: null });
      req.app.locals.auth.securityEvent(req.user.id, '2FA_CHANGE', { detail: '2FA disabled' });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  r.get('/security-events', authed, (req, res) => {
    res.json({ events: auth.securityEvents(req.user.id, 50) });
  });

  function _setSession(res, session, config) {
    res.cookie('nx_sid', session.id, {
      httpOnly: true, sameSite: 'lax', path: '/',
      maxAge: config.policy.sessionTtlMs,
    });
    res.cookie('nx_csrf', session.csrf, {
      httpOnly: false, sameSite: 'lax', path: '/',
      maxAge: config.policy.sessionTtlMs,
    });
  }

  return r;
}
