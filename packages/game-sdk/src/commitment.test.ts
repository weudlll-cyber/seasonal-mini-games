/**
 * @file   packages/game-sdk/src/commitment.test.ts
 * @module game-sdk
 * @brief  The seed commitment is sha256(seed) and verification rejects every mismatch.
 *
 * Responsibility: commitSeed equals sha256(seed); verifyCommitment is true for a matching
 *                 pair and false for a flipped byte or a wrong length. Taken over from
 *                 Bingo's packages/domain/src/commitment.test.ts.
 * Depends on:     vitest, ./commitment, ./drbg
 * Spec:           docs/spec/02-game-guess-the-number.md §10
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { commitSeed, verifyCommitment } from './commitment.js';
import { SEED_BYTES } from './drbg.js';

describe('seed commitment', () => {
  const seed = new Uint8Array(SEED_BYTES).map((_v, i) => i);

  it('matches sha256(seed) and verifies a matching pair', () => {
    expect(commitSeed(seed)).toEqual(new Uint8Array(createHash('sha256').update(seed).digest()));
    expect(verifyCommitment(seed, commitSeed(seed))).toBe(true);
  });

  it('is false when a byte is flipped or the length is wrong', () => {
    const flipped = new Uint8Array(commitSeed(seed));
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;
    expect(verifyCommitment(seed, flipped)).toBe(false);
    expect(verifyCommitment(seed, new Uint8Array(16))).toBe(false);
  });
});
