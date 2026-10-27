/**
 * @file   apps/server/src/auth/totp.test.ts
 * @module server/auth
 * @brief  TOTP against the SHA-1 vectors of RFC 6238, the drift window, single use, base32.
 *
 * Responsibility: the six-digit codes of RFC 6238 appendix B (the last six digits of its
 *                 eight-digit values, the same truncation); a code matches its own step and
 *                 one step either side, never two away, and only when newer than the last
 *                 step used; base32 follows the RFC 4648 §10 vectors and decodes back.
 * Depends on:     vitest, ./totp
 * Spec:           Bingo 03 §2; RFC 6238 appendix B; RFC 4648 §10
 */
import { describe, expect, it } from 'vitest';

import { base32Decode, base32Encode, hotp, matchingStep, otpauthUri, stepAt } from './totp.js';

const RFC_SECRET = new TextEncoder().encode('12345678901234567890');

describe('TOTP (RFC 6238, SHA-1)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ])('at %i s gives %s', (seconds, code) => {
    expect(hotp(RFC_SECRET, stepAt(seconds * 1000))).toBe(code);
  });

  it('accepts one step of drift either way, not two', () => {
    const now = 1234567890_000;
    const step = stepAt(now);
    for (const d of [-1, 0, 1]) {
      expect(matchingStep(RFC_SECRET, hotp(RFC_SECRET, step + d), now, 0)).toBe(step + d);
    }
    expect(matchingStep(RFC_SECRET, hotp(RFC_SECRET, step + 2), now, 0)).toBeNull();
    expect(matchingStep(RFC_SECRET, hotp(RFC_SECRET, step - 2), now, 0)).toBeNull();
  });

  it('accepts a step only when it is newer than the last one used', () => {
    const now = 1234567890_000;
    const step = stepAt(now);
    const code = hotp(RFC_SECRET, step);
    expect(matchingStep(RFC_SECRET, code, now, step)).toBeNull();
    expect(matchingStep(RFC_SECRET, code, now, step - 1)).toBe(step);
    expect(matchingStep(RFC_SECRET, '000000', now, 0)).toBeNull();
  });
});

describe('base32 (RFC 4648)', () => {
  it.each([
    ['', ''],
    ['f', 'MY'],
    ['fo', 'MZXQ'],
    ['foo', 'MZXW6'],
    ['foob', 'MZXW6YQ'],
    ['fooba', 'MZXW6YTB'],
    ['foobar', 'MZXW6YTBOI'],
  ])('encodes %j as %s and back', (text, encoded) => {
    const bytes = new TextEncoder().encode(text);
    expect(base32Encode(bytes)).toBe(encoded);
    expect(base32Decode(encoded)).toEqual(bytes);
  });

  it('decodes lower case, padding and spaces, and refuses other characters', () => {
    expect(new TextDecoder().decode(base32Decode('mzxw 6ytb oi======') ?? undefined)).toBe(
      'foobar',
    );
    expect(base32Decode('MZ1W')).toBeNull();
  });

  it('builds the otpauth URI with the base32 secret', () => {
    const uri = otpauthUri('dev-admin', RFC_SECRET);
    expect(uri.startsWith('otpauth://totp/Seasonal%20Mini%20Games%3Adev-admin?')).toBe(true);
    expect(new URL(uri).searchParams.get('secret')).toBe(base32Encode(RFC_SECRET));
  });
});
