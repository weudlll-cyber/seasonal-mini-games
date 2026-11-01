/**
 * @file   packages/game-sdk/src/commitment.ts
 * @module game-sdk
 * @brief  Round seed commitment: `sha256(seed)` with constant-time verification.
 *
 * Responsibility: compute the public commitment published at round creation and verify a
 *                 revealed seed against it (the fairness proof, owner decision O9). The
 *                 verify helper uses crypto.timingSafeEqual. Bingo's
 *                 packages/domain/src/commitment.ts, taken over unchanged.
 * Depends on:     node:crypto
 * Used by:        ./index, packages/domain (round creation), apps/server (verification)
 * Spec:           docs/spec/02-game-guess-the-number.md §10; Bingo 01 §9
 */
import { createHash, timingSafeEqual } from 'node:crypto';

export function commitSeed(seed: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(seed).digest());
}

export function verifyCommitment(seed: Uint8Array, commitment: Uint8Array): boolean {
  const computed = commitSeed(seed);
  if (computed.byteLength !== commitment.byteLength) return false;
  return timingSafeEqual(computed, commitment);
}
