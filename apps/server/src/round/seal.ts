/**
 * @file   apps/server/src/round/seal.ts
 * @module server/round
 * @brief  Seal and open a round seed with AES-256-GCM (06 §2.3 seed_enc).
 *
 * Responsibility: 12-byte random IV, 16-byte tag, then the ciphertext; opening checks the
 *                 tag, so a changed row fails loudly. Adapted from Bingo's match/codec.ts.
 * Depends on:     node:crypto
 * Used by:        ./pgRoundStore
 * Spec:           docs/spec/04-software-architecture.md §5.4; docs/spec/05-security-threat-model.md §3
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function sealSeed(seed: Uint8Array, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(seed), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function openSeed(sealed: Buffer, key: Buffer): Uint8Array {
  const decipher = createDecipheriv('aes-256-gcm', key, sealed.subarray(0, 12));
  decipher.setAuthTag(sealed.subarray(12, 28));
  return new Uint8Array(Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()]));
}
