import { ORDER_TRANSITIONS, ORDER_TERMINAL } from '../../../shared/contracts.js';

export class OrderStateError extends Error {
  constructor(from, to) {
    super(`Illegal order state transition: ${from} -> ${to}`);
    this.name = 'OrderStateError';
    this.code = 'ILLEGAL_STATE_TRANSITION';
    this.status = 409;
    this.from = from;
    this.to = to;
  }
}

export function canTransition(from, to) {
  if (from === to) return false;
  return (ORDER_TRANSITIONS[from] ?? []).includes(to);
}

/** Asserts a transition is legal; throws OrderStateError otherwise. */
export function assertTransition(from, to) {
  if (!canTransition(from, to)) throw new OrderStateError(from, to);
  return true;
}

export function isTerminal(state) {
  return ORDER_TERMINAL.has(state);
}

/** States in which a user/operator may request cancellation. */
export function cancellableFrom(state) {
  return ['CREATED', 'VALIDATING', 'OPEN', 'PARTIALLY_FILLED'].includes(state);
}

/** States an operator may release back to OPEN. */
export function releasableToOpen(state) {
  return ['MANUAL_REVIEW', 'CANCEL_REQUESTED'].includes(state);
}
