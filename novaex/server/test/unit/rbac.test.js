import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, effectivePerms, modeRoles, assertCan, PermissionError } from '../../src/domain/rbac.js';

test('customers cannot touch operator capabilities', () => {
  assert.equal(can('user', 'ops:read'), false);
  assert.equal(can('user', 'orders:ops:read'), false);
  assert.equal(can('user', 'withdrawals:act:approve'), false);
  assert.equal(can('user', 'system:act:single'), false);
});

test('customers get customer capabilities', () => {
  assert.equal(can('user', 'markets:read'), true);
  assert.equal(can('user', 'portfolio:read'), true);
  assert.equal(can('user', 'orders:create:market'), true);
});

test('pro traders get advanced order types but not operator actions', () => {
  assert.equal(can('trader', 'orders:create:limit'), true);
  assert.equal(can('trader', 'orders:create:stop'), true);
  assert.equal(can('trader', 'pro:terminal'), true);
  assert.equal(can('trader', 'ops:read'), false);
  assert.equal(can('trader', 'orders:act:cancel'), false);
});

test('operators can act on orders/withdrawals but not approve or dual-control', () => {
  assert.equal(can('operator', 'orders:act:cancel'), true);
  assert.equal(can('operator', 'orders:act:hold'), true);
  assert.equal(can('operator', 'withdrawals:act:review'), true);
  assert.equal(can('operator', 'audit:read'), true);
  assert.equal(can('operator', 'system:act:single'), true);
});

test('admins carry everything, including approvals and dual controls', () => {
  assert.equal(can('admin', 'approvals:act'), true);
  assert.equal(can('admin', 'system:act:dual'), true);
  assert.equal(can('admin', 'fees:act'), true);
  assert.equal(can('admin', 'orders:act:cancel'), true); // inherited
});

test('permission sets are non-empty and strings', () => {
  for (const role of ['user', 'trader', 'operator', 'admin']) {
    const perms = effectivePerms(role);
    assert.ok(perms.size > 0);
    for (const p of perms) assert.equal(typeof p, 'string');
  }
});

test('assertCan throws typed PermissionError', () => {
  assert.throws(() => assertCan('user', 'ops:read'), (e) => e instanceof PermissionError && e.code === 'FORBIDDEN');
  assert.equal(assertCan('admin', 'ops:read'), true);
});

test('mode role gates', () => {
  assert.deepEqual(modeRoles('simple').sort(), ['admin', 'operator', 'trader', 'user']);
  assert.ok(modeRoles('pro').includes('trader'));
  assert.ok(!modeRoles('pro').includes('user'));
  assert.deepEqual(modeRoles('ops'), ['operator', 'admin']);
});
