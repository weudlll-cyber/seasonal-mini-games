/**
 * @file   apps/server/src/round/seal.test.ts
 * @module server/round
 * @brief  Sealed round seeds open with their key only and show any change.
 *
 * Responsibility: a sealed seed opens to the same bytes, every seal uses a fresh IV, and a
 *                 wrong key or a changed byte is refused. Adapted from Bingo's codec test.
 * Depends on:     vitest, node:crypto, ./seal
 * Spec:           docs/spec/05-security-threat-model.md §3
 */
import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { openSeed, sealSeed } from './seal.js';

describe('seed sealing', () => {
  const key = randomBytes(32);
  const seed = new Uint8Array(randomBytes(32));

  it('opens what it sealed, with a fresh IV every time', () => {
    const sealed = sealSeed(seed, key);
    expect(openSeed(sealed, key)).toEqual(seed);
    expect(sealSeed(seed, key).equals(sealed)).toBe(false);
  });

  it('refuses a wrong key and a changed byte', () => {
    const sealed = sealSeed(seed, key);
    expect(() => openSeed(sealed, randomBytes(32))).toThrow();
    const tampered = Buffer.from(sealed);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 1;
    expect(() => openSeed(tampered, key)).toThrow();
  });
});
