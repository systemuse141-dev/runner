// Auth service: registration, login, scrypt password hashing, TOTP 2FA,
// secure sessions (httpOnly cookies), session revocation.

import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { generateSecret, verifyTotp, otpauthUri } from '../domain/totp.js';

export class AuthError extends Error {
  constructor(msg, code = 'AUTH_ERROR', status = 400) {
    super(msg);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function weakPassword(pw) {
  if (!pw || pw.length < 10) return 'Password must be at least 10 characters.';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Password must contain letters and numbers.';
  return null;
}

export class AuthService {
  constructor(ctx) {
    this.store = ctx.store;
    this.config = ctx.config;
    this.audit = ctx.audit;
    this.notify = ctx.notify;
  }

  securityEvent(userId, kind, { detail = null, ip = null, success = true } = {}) {
    return this.store.insert('security_events', {
      id: crypto.randomUUID(), user_id: userId, kind, detail, ip, success, ts: Date.now(),
    });
  }

  async register({ email, password, name }) {
    email = String(email ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new AuthError('Enter a valid email address.', 'BAD_EMAIL', 422);
    const weak = weakPassword(password);
    if (weak) throw new AuthError(weak, 'WEAK_PASSWORD', 422);
    const existing = (await this.store.all('users', { eq: { email }, limit: 1 }))[0];
    if (existing) throw new AuthError('An account with this email already exists.', 'DUPLICATE_EMAIL', 409);

    const user = await this.store.insert('users', {
      id: crypto.randomUUID(),
      email,
      name: String(name ?? email.split('@')[0]).trim() || email.split('@')[0],
      password_hash: hashPassword(password),
      role: 'user',
      totp_secret: null,
      account_status: 'ACTIVE',
      created_at: Date.now(),
    });
    await this.store.insert('profiles', {
      id: crypto.randomUUID(), user_id: user.id, full_name: user.name,
      locale: 'en-US', theme: 'dark', created_at: Date.now(),
    });
    this.securityEvent(user.id, 'REGISTER', { detail: 'Account created' });
    await this.notify.send(user.id, { kind: 'welcome', title: 'Welcome to NOVAEX', body: 'Your account is ready. Set up 2FA in Security to protect it.' });
    return user;
  }

  async login({ email, password, code, ip = null }) {
    email = String(email ?? '').trim().toLowerCase();
    const user = (await this.store.all('users', { eq: { email }, limit: 1 }))[0];
    const fail = (msg) => {
      if (user) this.securityEvent(user.id, 'LOGIN_FAILED', { detail: msg, ip, success: false });
      throw new AuthError('Invalid email or password.', 'BAD_CREDENTIALS', 401);
    };
    if (!user) {
      // burn time to reduce user enumeration
      scryptSync('x', randomBytes(16), 64);
      fail('no user');
    }
    if (!verifyPassword(password, user.password_hash)) fail('bad password');

    if (user.totp_secret) {
      if (!code) {
        const pending = await this.store.insert('sessions', {
          id: crypto.randomUUID(), user_id: user.id, csrf: randomBytes(24).toString('hex'),
          user_agent: null, ip, expires_at: Date.now() + 5 * 60e3, revoked_at: null, created_at: Date.now(),
          pending_2fa: true,
        });
        return { needs2fa: true, sessionId: pending.id };
      }
      if (!verifyTotp(user.totp_secret, code)) {
        this.securityEvent(user.id, '2FA_FAILED', { detail: 'Bad 2FA code', ip, success: false });
        throw new AuthError('Invalid 2FA code.', 'BAD_2FA', 401);
      }
    }

    if (user.account_status === 'HOLD') throw new AuthError('Account is on hold. Contact support.', 'ON_HOLD', 403);

    const session = await this.store.insert('sessions', {
      id: crypto.randomUUID(), user_id: user.id,
      csrf: randomBytes(24).toString('hex'),
      user_agent: null, ip,
      expires_at: Date.now() + this.config.policy.sessionTtlMs,
      revoked_at: null, created_at: Date.now(),
    });
    this.securityEvent(user.id, 'LOGIN', { detail: 'Login success', ip });
    return { session, user: this.safeUser(user) };
  }

  /** Complete a 2FA-pending session. */
  async complete2fa(sessionId, code) {
    const s = await this.store.get('sessions', sessionId);
    if (!s || !s.pending_2fa) throw new AuthError('Invalid or expired 2FA session.', 'BAD_SESSION', 401);
    if (s.expires_at < Date.now()) throw new AuthError('2FA session expired.', 'EXPIRED', 401);
    const user = await this.store.get('users', s.user_id);
    if (!user || !verifyTotp(user.totp_secret, code)) {
      this.securityEvent(user.id, '2FA_FAILED', { detail: 'Bad 2FA code', success: false });
      throw new AuthError('Invalid 2FA code.', 'BAD_2FA', 401);
    }
    await this.store.update('sessions', sessionId, { pending_2fa: false });
    this.securityEvent(user.id, '2FA_SUCCESS', { detail: 'Login completed with 2FA' });
    return { user: this.safeUser(user) };
  }

  sessionForCookie(cookieValue) {
    if (!cookieValue) return null;
    const s = this.store.all('sessions', { eq: { id: cookieValue }, limit: 1 })[0];
    if (!s || s.revoked_at || s.expires_at < Date.now() || s.pending_2fa) return null;
    return s;
  }

  async logout(sessionId) {
    await this.store.update('sessions', sessionId, { revoked_at: Date.now() });
  }

  listSessions(userId) {
    return this.store.all('sessions', { eq: { user_id: userId }, order: 'created_at', dir: 'desc', limit: 20 });
  }

  revokeSession(userId, sessionId) {
    const s = this.store.get('sessions', sessionId);
    if (!s || s.user_id !== userId) throw new AuthError('Session not found.', 'NOT_FOUND', 404);
    return this.store.update('sessions', sessionId, { revoked_at: Date.now() });
  }

  async changePassword(user, { current, next }) {
    if (!verifyPassword(current, user.password_hash)) throw new AuthError('Current password is incorrect.', 'BAD_CURRENT', 401);
    const weak = weakPassword(next);
    if (weak) throw new AuthError(weak, 'WEAK_PASSWORD', 422);
    await this.store.update('users', user.id, { password_hash: hashPassword(next) });
    this.securityEvent(user.id, 'PASSWORD_CHANGE', { detail: 'Password changed' });
    // revoke all other sessions
    for (const s of this.store.all('sessions', { eq: { user_id: user.id } })) {
      if (!s.revoked_at) await this.store.update('sessions', s.id, { revoked_at: Date.now() });
    }
  }

  setup2fa(user) {
    const secret = generateSecret();
    return { secret, uri: otpauthUri(secret, user.email) };
  }

  enable2fa(user, secret, code) {
    if (!verifyTotp(secret, code)) throw new AuthError('Invalid 2FA code.', 'BAD_2FA', 401);
    const userRow = this.store.get('users', user.id);
    if (userRow.totp_secret !== secret) throw new AuthError('Secret mismatch — start setup again.', 'BAD_SECRET', 400);
    this.securityEvent(user.id, '2FA_CHANGE', { detail: '2FA enabled' });
  }

  disable2fa(user, code) {
    if (!user.totp_secret) throw new AuthError('2FA is not enabled.', 'NO_2FA', 400);
    if (!verifyTotp(user.totp_secret, code)) throw new AuthError('Invalid 2FA code.', 'BAD_2FA', 401);
    this.securityEvent(user.id, '2FA_CHANGE', { detail: '2FA disabled' });
  }

  securityEvents(userId, limit = 30) {
    return this.store.all('security_events', { eq: { user_id: userId }, order: 'ts', dir: 'desc', limit });
  }

  safeUser(user) {
    return {
      id: user.id, email: user.email, name: user.name, role: user.role,
      twoFA: !!user.totp_secret, account_status: user.account_status,
      created_at: user.created_at,
    };
  }
}
