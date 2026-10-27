/**
 * @file   apps/server/src/auth/totp.ts
 * @module server/auth
 * @brief  Time-based one-time passwords (RFC 6238 over RFC 4226) and base32 (RFC 4648).
 *
 * Responsibility: the code of a time step (HMAC-SHA-1, 30-second steps, 6 digits); the step a
 *                 code matches within one step of drift either way and newer than the last
 *                 step used, so a code works once; the base32 text of a secret for the
 *                 authenticator app and back; the otpauth URI. Pure, the clock passed in.
 * Depends on:     node:crypto
 * Used by:        ./twoFactor, ./totp.test, test/adminTwoFactor.integration.test
 * Spec:           Bingo 03 §2 (2FA, TOTP RFC 6238); Bingo 05 §2.1
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const STEP_MS = 30_000;
const DIGITS = 1_000_000;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const stepAt = (ms: number): number => Math.floor(ms / STEP_MS);

// RFC 4226 §5.3: dynamic truncation of the HMAC of the counter, six digits.
export function hotp(secret: Uint8Array, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', secret).update(message).digest();
  const offset = (mac[19] ?? 0) & 0xf;
  const value = (mac.readUInt32BE(offset) & 0x7fffffff) % DIGITS;
  return String(value).padStart(6, '0');
}

// The step `code` belongs to (now, one before or one after) when it is newer than
// `lastStep`; null otherwise. Every candidate is compared in constant time.
export function matchingStep(
  secret: Uint8Array,
  code: string,
  now: number,
  lastStep: number,
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = stepAt(now);
  let found: number | null = null;
  for (const step of [current - 1, current, current + 1]) {
    const same = timingSafeEqual(Buffer.from(hotp(secret, step)), Buffer.from(code));
    if (same && step > lastStep && found === null) found = step;
  }
  return found;
}

// Base32 without padding, as authenticator apps expect it.
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let buffer = 0;
  let out = '';
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET.charAt((buffer >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET.charAt((buffer << (5 - bits)) & 31);
  return out;
}

// Upper or lower case, with or without padding and spaces; null for another character.
export function base32Decode(text: string): Uint8Array | null {
  const clean = text.toUpperCase().replace(/[\s=]/g, '');
  let bits = 0;
  let buffer = 0;
  const out: number[] = [];
  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) return null;
    buffer = ((buffer << 5) | value) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

const ISSUER = 'Seasonal Mini Games';

// Key URI format of the authenticator apps: label "issuer:account", SHA-1, 6 digits, 30 s.
export function otpauthUri(account: string, secret: Uint8Array): string {
  const label = encodeURIComponent(`${ISSUER}:${account}`);
  const query = new URLSearchParams({
    secret: base32Encode(secret),
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}
