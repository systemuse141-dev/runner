import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransition, assertTransition, isTerminal, cancellableFrom, OrderStateError,
} from '../../src/domain/orderStateMachine.js';
import { ORDER_STATES } from '../../../shared/contracts.js';

test('legal lifecycle: created -> validating -> open -> partially_filled -> filled', () => {
  assert.equal(canTransition('CREATED', 'VALIDATING'), true);
  assert.equal(canTransition('VALIDATING', 'OPEN'), true);
  assert.equal(canTransition('OPEN', 'PARTIALLY_FILLED'), true);
  assert.equal(canTransition('PARTIALLY_FILLED', 'FILLED'), true);
});

test('cancel flow: cancel_request required before cancelled', () => {
  assert.equal(canTransition('OPEN', 'CANCEL_REQUESTED'), true);
  assert.equal(canTransition('CANCEL_REQUESTED', 'CANCELLED'), true);
  assert.equal(canTransition('OPEN', 'CANCELLED'), false); // no direct jump
  assert.equal(canTransition('VALIDATING', 'CANCELLED'), true); // cancel while validating
  assert.equal(canTransition('CREATED', 'CANCELLED'), true);
});

test('operator can cancel a cancel request (resume)', () => {
  assert.equal(canTransition('CANCEL_REQUESTED', 'OPEN'), true);
});

test('manual review routing and release', () => {
  assert.equal(canTransition('VALIDATING', 'MANUAL_REVIEW'), true);
  assert.equal(canTransition('OPEN', 'MANUAL_REVIEW'), true);
  assert.equal(canTransition('PARTIALLY_FILLED', 'MANUAL_REVIEW'), true);
  assert.equal(canTransition('MANUAL_REVIEW', 'OPEN'), true);
  assert.equal(canTransition('MANUAL_REVIEW', 'CANCELLED'), true);
  assert.equal(canTransition('MANUAL_REVIEW', 'FILLED'), false); // reviewed orders do not auto-fill
});

test('rejection paths', () => {
  assert.equal(canTransition('CREATED', 'REJECTED'), true);
  assert.equal(canTransition('VALIDATING', 'REJECTED'), true);
  assert.equal(canTransition('OPEN', 'REJECTED'), true);
  assert.equal(canTransition('FILLED', 'REJECTED'), false);
});

test('terminal states are immutable', () => {
  for (const t of ['FILLED', 'CANCELLED', 'REJECTED']) {
    assert.equal(isTerminal(t), true);
    for (const to of ORDER_STATES) assert.equal(canTransition(t, to), false, `${t} -> ${to} must be illegal`);
  }
});

test('no self-transitions', () => {
  for (const s of ORDER_STATES) assert.equal(canTransition(s, s), false, `${s} -> ${s}`);
});

test('assertTransition throws a typed error with code', () => {
  assert.throws(() => assertTransition('FILLED', 'OPEN'), (e) => {
    assert.equal(e.name, 'OrderStateError');
    assert.equal(e.code, 'ILLEGAL_STATE_TRANSITION');
    assert.equal(e.from, 'FILLED');
    assert.equal(e.to, 'OPEN');
    return true;
  });
});

test('cancellableFrom matches the documented set', () => {
  assert.ok(cancellableFrom('CREATED'));
  assert.ok(cancellableFrom('VALIDATING'));
  assert.ok(cancellableFrom('OPEN'));
  assert.ok(cancellableFrom('PARTIALLY_FILLED'));
  assert.ok(!cancellableFrom('MANUAL_REVIEW'));
  assert.ok(!cancellableFrom('FILLED'));
  assert.ok(!cancellableFrom('CANCELLED'));
});
