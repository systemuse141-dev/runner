// Minimal RFC-6238 TOTP (SHA-1, 6 digits, 30s step) for demo 2FA.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret(bytes = 20) {
  const raw = randomBytes(bytes);
  let bits = 0, value = 0, out = '';
  for (const b of raw) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}

function b32decode(secret) {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret, counter) {
  const key = b32decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', key).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

export function totp(secret, at = Date.now(), stepSec = 30) {
  return hotp(secret, Math.floor(at / 1000 / stepSec));
}

/** Verify with ±1 step window to absorb clock skew. */
export function verifyTotp(secret, code, at = Date.now(), window = 1) {
  const c = Math.floor(at / 1000 / 30);
  const s = String(code).trim();
  for (let i = -window; i <= window; i++) {
    const t = hotp(secret, c + i);
    if (timingSafeEqual(Buffer.from(s.padStart(6, '0')), Buffer.from(t))) return true;
  }
  return false;
}

export function otpauthUri(secret, account, issuer = 'NOVAEX') {
  return `otpauth://totp/${issuer}:${encodeURIComponent(account)}?secret=${secret}&issuer=${issuer}&digits=6&period=30`;
}
