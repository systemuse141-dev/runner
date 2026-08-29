import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from '../helpers.js';

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.srv.close(); });

test('operator actions produce audit entries with full metadata', async () => {
  const before = app.store.count('audit_logs');
  await app.call('POST', '/api/v1/operator/system/control', {
    user: app.user.ops, body: { key: 'sell', value: 'PAUSED', reason: 'Audit test' },
  });
  await app.call('POST', '/api/v1/operator/system/control', {
    user: app.user.ops, body: { key: 'sell', value: 'LIVE', reason: 'Audit test done' },
  });
  const after = app.store.count('audit_logs');
  assert.ok(after >= before + 2);
  const ev = app.store.all('audit_logs', { eq: { action: 'system.sell_paused' } })[0];
  assert.equal(ev.actor, 'u_ops');
  assert.equal(ev.role, 'operator');
  assert.equal(ev.target_type, 'system');
  assert.equal(ev.target_id, 'sell');
  assert.equal(ev.old_state, 'LIVE');
  assert.equal(ev.new_state, 'PAUSED');
  assert.equal(ev.reason, 'Audit test');
  assert.ok(ev.id.startsWith('AUD-'));
  assert.ok(ev.ts > 0);
});

test('audit log is append-only at the store level', async () => {
  const ev = app.store.all('audit_logs', { limit: 1 })[0];
  assert.throws(() => app.store.update('audit_logs', ev.id, { actor: 'hacker' }), (e) => e.name === 'AppendOnlyError');
  assert.throws(() => app.store.remove('audit_logs', ev.id), (e) => e.name === 'AppendOnlyError');
});

test('executed trades and order fills are append-only', async () => {
  const trade = app.store.all('trades', { limit: 1 })[0];
  assert.throws(() => app.store.update('trades', trade.id, { price: 1 }), (e) => e.name === 'AppendOnlyError');
  const fill = app.store.all('order_fills', { limit: 1 })[0];
  assert.throws(() => app.store.update('order_fills', fill.id, { qty: 1 }), (e) => e.name === 'AppendOnlyError');
  const oe = app.store.all('order_events', { limit: 1 })[0];
  assert.throws(() => app.store.update('order_events', oe.id, { reason: 'x' }), (e) => e.name === 'AppendOnlyError');
});

test('audit query filters work (actor, action, window)', async () => {
  const byActor = await app.call('GET', '/api/v1/audit?actor=u_ops&limit=50', { user: app.user.maya });
  assert.equal(byActor.status, 200);
  assert.ok(byActor.json.events.length > 0);
  assert.ok(byActor.json.events.every((e) => e.actor === 'u_ops'));

  const byAction = await app.call('GET', '/api/v1/audit?action=system.sell_paused', { user: app.user.maya });
  assert.ok(byAction.json.events.every((e) => e.action === 'system.sell_paused'));

  const from = Date.now() - 60_000;
  const windowed = await app.call('GET', `/api/v1/audit?from=${from}`, { user: app.user.maya });
  assert.ok(windowed.json.events.every((e) => e.ts >= from));
});

test('customers cannot read the audit log', async () => {
  const res = await app.call('GET', '/api/v1/audit', { user: app.user.alice });
  assert.equal(res.status, 403);
});

test('audit trail exists for the seeded operator actions', async () => {
  const events = app.store.all('audit_logs', { limit: 500 });
  const actions = new Set(events.map((e) => e.action));
  assert.ok(actions.has('withdrawal.approve'));
  assert.ok(actions.has('adjustment.create'));
  assert.ok(actions.has('order.risk_hold'));
});
