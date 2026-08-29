// Exact decimal money math on integer minor units.
// No floating point is ever used for an authoritative monetary value.

import { ASSET_DECIMALS } from './contracts.js';

export class MoneyError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'MoneyError';
    this.code = 'BAD_AMOUNT';
    this.status = 400;
  }
}

export function decimals(asset) {
  return ASSET_DECIMALS[asset] ?? 8;
}

const pow10 = (n) => 10 ** n;

/** Parse a human decimal string ("1234.5") into integer minor units.
 *  Thousands separators (commas) are accepted. */
export function toMinor(asset, value) {
  const raw = typeof value === 'number' ? String(value) : String(value).trim();
  const s = raw.replace(/,/g, '');
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s)) throw new MoneyError(`Invalid amount: ${value}`);
  const neg = s.startsWith('-');
  const abs = neg ? s.slice(1) : s;
  const [intPart = '0', fracPart = ''] = abs.split('.');
  const d = decimals(asset);
  if (fracPart.length > d) throw new MoneyError(`Too many decimals for ${asset} (max ${d})`);
  const frac = (fracPart + '0'.repeat(d)).slice(0, d);
  const minor = BigInt(intPart || '0') * BigInt(pow10(d)) + BigInt(frac || '0');
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new MoneyError('Amount out of safe range');
  const n = Number(minor);
  return neg ? -n : n;
}

/** Integer minor units -> human decimal string. */
export function toHuman(asset, minor) {
  if (!Number.isInteger(minor)) throw new MoneyError('Amount must be integer minor units');
  const d = decimals(asset);
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const int = Math.floor(abs / pow10(d));
  const frac = String(abs % pow10(d)).padStart(d, '0');
  return `${neg ? '-' : ''}${int}.${frac}`;
}

/** Convert minor units of one asset to another via a price (minor of quote per minor of base).
 *  Used ONLY for display/estimation, never as an authoritative balance write. */
export function convertMinor(baseAsset, baseMinor, quoteAsset, quoteMinor, priceMinorPerMinor) {
  const num = BigInt(baseMinor) * BigInt(quoteMinor);
  const den = BigInt(priceMinorPerMinor) || 1n;
  const q = num / den;
  return Number(q);
}

/** Multiply integer minor units by basis points with explicit rounding.
 *  mode: 'half_up' | 'down' | 'up' (up rounds away from zero for fees). */
export function mulBps(minor, bps, mode = 'half_up') {
  const a = BigInt(minor);
  const b = BigInt(bps);
  const DEN = 10_000n;
  const neg = (a < 0n) !== (b < 0n);
  const A = a < 0n ? -a : a;
  const B = b < 0n ? -b : b;
  const num = A * B;
  let q;
  if (mode === 'down') q = num / DEN; // toward zero
  else if (mode === 'up') q = (num + DEN - 1n) / DEN; // away from zero
  else {
    const r = num % DEN;
    q = num / DEN + (r * 2n >= DEN ? 1n : 0n);
  }
  return Number(neg ? -q : q);
}

/** Add with safe-integer guard. */
export function add(a, b) {
  const r = a + b;
  if (!Number.isSafeInteger(r)) throw new MoneyError('Amount overflow');
  return r;
}

/** Format for display: thousands separators, trimmed decimals, optional sign. */
export function fmtMoney(asset, minor, { prefix = '', suffix = '', forceDecimals = false, sign = false } = {}) {
  const d = decimals(asset);
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const d2 = forceDecimals ? d : Math.min(d, 2);
  const scaled = Math.round(abs / pow10(d - d2)); // integer in 10^-d2 units
  const i = Math.floor(scaled / pow10(d2));
  const f = d2 > 0 ? String(scaled % pow10(d2)).padStart(d2, '0') : '';
  return `${sign && minor > 0 ? '+' : ''}${neg ? '-' : ''}${prefix}${i.toLocaleString('en-US')}${f ? `.${f}` : ''}${suffix}`;
}

/** Compact USD-style formatting for large totals (USDT treated as USD). */
export function fmtUsd(minorUsdt) {
  return fmtMoney('USDT', minorUsdt, { prefix: '$' });
}

/** Price formatting: choose sensible decimals from magnitude. */
export function fmtPrice(quoteAsset, minor, { prefix = '' } = {}) {
  const d = decimals(quoteAsset);
  const v = Math.abs(minor) / pow10(d);
  let d2;
  if (v >= 1000) d2 = 1;
  else if (v >= 100) d2 = 2;
  else if (v >= 1) d2 = 3;
  else if (v >= 0.01) d2 = 4;
  else d2 = 6;
  d2 = Math.min(d2, d);
  const scaled = Math.round(Math.abs(minor) / pow10(d - d2));
  const i = Math.floor(scaled / pow10(d2));
  const f = d2 > 0 ? String(scaled % pow10(d2)).padStart(d2, '0') : '';
  const sign = minor < 0 ? '-' : '';
  return `${sign}${prefix}${i.toLocaleString('en-US')}${f ? `.${f}` : ''}`;
}

export function pct(a, b) {
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}
