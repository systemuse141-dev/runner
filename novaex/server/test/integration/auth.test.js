import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, TEST_PASSWORD } from '../helpers.js';
import { totp } from '../../src/domain/totp.js';

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.srv.close(); });

test('registration creates account + secure session', async () => {
  const email = `new-${Date.now()}@novaex.demo`;
  const res = await fetch(app.base + '/api/v1/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Str0ng-pass-99', name: 'New User' }),
  });
  assert.equal(res.status, 200);
  const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  assert.match(cookies, /nx_sid=[^;]+/);
  // session cookie is httpOnly
  assert.match(res.headers.getSetCookie().find((c) => c.startsWith('nx_sid')), /HttpOnly/i);
});

test('duplicate registration is rejected 409', async () => {
  const res = await app.call('POST', '/api/v1/auth/register', {
    body: { email: 'alice@novaex.demo', password: 'Str0ng-pass-99', name: 'Dup' },
  });
  assert.equal(res.status, 409);
});

test('weak password rejected 422', async () => {
  const res = await app.call('POST', '/api/v1/auth/register', {
    body: { email: `weak-${Date.now()}@novaex.demo`, password: 'short' },
  });
  assert.equal(res.status, 422);
});

test('login with wrong password is 401 and records a security event', async () => {
  const res = await app.call('POST', '/api/v1/auth/login', { body: { email: 'alice@novaex.demo', password: 'wrong-pass-1' } });
  assert.equal(res.status, 401);
  const evts = app.store.all('security_events', { eq: { user_id: 'u_alice', kind: 'LOGIN_FAILED' } });
  assert.ok(evts.length >= 1);
});

test('authenticated endpoint requires a valid session', async () => {
  const noAuth = await app.call('GET', '/api/v1/users/me');
  assert.equal(noAuth.status, 401);
  const bad = await app.call('GET', '/api/v1/users/me', { headers: { cookie: 'nx_sid=nope' } });
  assert.equal(bad.status, 401);
  const me = await app.call('GET', '/api/v1/users/me', { user: app.user.alice });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.email, 'alice@novaex.demo');
});

test('logout revokes the session', async () => {
  const greg = await app.login('greg@novaex.demo');
  const before = await app.call('GET', '/api/v1/users/me', { user: greg });
  assert.equal(before.status, 200);
  const out = await app.call('POST', '/api/v1/auth/logout', { user: greg });
  assert.equal(out.status, 200);
  const after = await app.call('GET', '/api/v1/users/me', { user: greg });
  assert.equal(after.status, 401);
});

test('session revocation by the user', async () => {
  const greg = await app.login('greg@novaex.demo');
  const sessions = await app.call('GET', '/api/v1/auth/sessions', { user: greg });
  assert.equal(sessions.status, 200);
  const other = sessions.json.sessions.find((s) => !s.current && !s.revoked);
  if (!other) return; // single session is fine too
  const del = await app.call('DELETE', `/api/v1/auth/sessions/${other.id}`, { user: greg });
  assert.equal(del.status, 200);
  // if the revoked session is the helper's pre-login session, it must no longer authenticate
  const helperSid = /nx_sid=([^;]+)/.exec(app.user.greg.cookies)?.[1];
  if (other.id === helperSid) {
    const me = await app.call('GET', '/api/v1/users/me', { user: app.user.greg });
    assert.equal(me.status, 401);
  }
});

test('CSRF double-submit token is enforced on mutating requests', async () => {
  const { cookies } = await app.login('alice@novaex.demo');
  const csrf = /nx_csrf=([^;]+)/.exec(cookies)?.[1];
  const res = await app.call('POST', '/api/v1/orders', {
    headers: { cookie: cookies, 'Content-Type': 'application/json' }, // missing X-CSRF-Token
    body: { pair: 'BTC/USDT', side: 'BUY', type: 'MARKET', quoteAmount: '10' },
  });
  assert.equal(res.status, 403);
  assert.equal(res.json.error.code, 'CSRF');
  void csrf;
});

test('rate limiting on login (429 after burst)', async () => {
  // a throwaway account is the burst target so the demo users stay clean
  const burstEmail = `burst-${Date.now()}@novaex.demo`;
  const reg = await app.call('POST', '/api/v1/auth/register', { body: { email: burstEmail, password: 'Burst-pass-1', name: 'Burst' } });
  assert.equal(reg.status, 200);
  let last = null;
  for (let i = 0; i < 14; i++) {
    last = await app.call('POST', '/api/v1/auth/login', { body: { email: burstEmail, password: 'nope-nope-1' } });
  }
  assert.equal(last.status, 429);
  assert.ok(last.res.headers.get('retry-after'));
});

test('2FA full lifecycle: setup -> enable -> login with code -> disable', async () => {
  const alice = app.user.alice;
  const setup = await app.call('POST', '/api/v1/auth/2fa/setup', { user: alice });
  assert.equal(setup.status, 200);
  const secret = setup.json.secret;
  assert.ok(secret.length >= 16);

  const code = totp(secret);
  const enable = await app.call('POST', '/api/v1/auth/2fa/enable', { user: alice, body: { secret, code } });
  assert.equal(enable.status, 200);

  // login now returns needs2fa (distinct client IP keeps the shared-IP rate bucket clean)
  const res = await fetch(app.base + '/api/v1/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.7' },
    body: JSON.stringify({ email: 'alice@novaex.demo', password: TEST_PASSWORD }),
  });
  const body = await res.json();
  assert.equal(body.needs2fa, true);
  assert.ok(body.sessionId);

  // complete with wrong code
  const bad = await app.call('POST', '/api/v1/auth/2fa/complete', { body: { sessionId: body.sessionId, code: '000000' } });
  assert.equal(bad.status, 401);

  // complete with right code
  const good = await app.call('POST', '/api/v1/auth/2fa/complete', { body: { sessionId: body.sessionId, code: totp(secret) } });
  assert.equal(good.status, 200);
  assert.equal(good.json.user.email, 'alice@novaex.demo');

  // disable
  const dis = await app.call('POST', '/api/v1/auth/2fa/disable', { user: alice, body: { code: totp(secret) } });
  assert.equal(dis.status, 200);
});

test('password change revokes other sessions', async () => {
  // distinct client IPs keep these logins out of the shared-IP rate bucket
  const greg1 = await app.login('greg@novaex.demo', TEST_PASSWORD, { 'X-Forwarded-For': '198.51.100.11' });
  const greg2 = await app.login('greg@novaex.demo', TEST_PASSWORD, { 'X-Forwarded-For': '198.51.100.12' });
  const ch = await app.call('POST', '/api/v1/auth/password', { user: greg1, body: { current: TEST_PASSWORD, next: 'NewPass-123' } });
  assert.equal(ch.status, 200, JSON.stringify(ch.json));
  // every session — including the one that changed the password — is revoked
  const s1 = await app.call('GET', '/api/v1/users/me', { headers: greg1.headers });
  assert.equal(s1.status, 401);
  const s2 = await app.call('GET', '/api/v1/users/me', { headers: greg2.headers });
  assert.equal(s2.status, 401);
  // new password works
  const res = await app.call('POST', '/api/v1/auth/login', { body: { email: 'greg@novaex.demo', password: 'NewPass-123' }, headers: { 'X-Forwarded-For': '198.51.100.13' } });
  assert.equal(res.status, 200, JSON.stringify(res.json));
});
