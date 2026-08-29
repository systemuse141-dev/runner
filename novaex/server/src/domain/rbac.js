import { PERMISSIONS, ROLE_INHERITANCE, ROLES } from '../../../shared/contracts.js';

export class PermissionError extends Error {
  constructor(role, perm) {
    super(`Role "${role}" lacks permission "${perm}"`);
    this.name = 'PermissionError';
    this.code = 'FORBIDDEN';
    this.status = 403;
    this.perm = perm;
  }
}

export function effectiveRoles(role) {
  return ROLE_INHERITANCE[role] ?? (ROLES.includes(role) ? [role] : []);
}

export function effectivePerms(role) {
  const set = new Set();
  for (const r of effectiveRoles(role)) for (const p of PERMISSIONS[r] ?? []) set.add(p);
  return set;
}

export function can(role, perm) {
  return effectivePerms(role).has(perm);
}

export function assertCan(role, perm) {
  if (!can(role, perm)) throw new PermissionError(role, perm);
  return true;
}

/** Roles allowed into a mode. */
export function modeRoles(mode) {
  switch (mode) {
    case 'simple': return ['user', 'trader', 'operator', 'admin'];
    case 'pro': return ['trader', 'admin'];
    case 'ops': return ['operator', 'admin'];
    default: return [];
  }
}
