/**
 * @file   packages/game-sdk/src/drbg.ts
 * @module game-sdk
 * @brief  Deterministic random generator built on HMAC-SHA256, and the per-round labelled view.
 *
 * Responsibility: given a 32-byte secret seed and a domain-separation label, return a
 *                 cursor that yields uint32 values and uniform bounded integers (rejection
 *                 sampling, never a modulo bias), reproducible across runs. `roundRng` hands a
 *                 game only labelled children of the round seed, never the seed itself.
 *                 The construction "HMAC(seed, label || counter)" is Bingo's
 *                 packages/domain/src/draw/drbg.ts, taken over unchanged and extended.
 * Depends on:     node:crypto (HMAC-SHA256, pure in/out), ./random (types)
 * Used by:        ./crypto, packages/domain
 * Spec:           docs/spec/04-software-architecture.md §5.4; docs/spec/05-security-threat-model.md §4
 */
import { createHmac } from 'node:crypto';

import type { Drbg, RoundRng } from './random.js';

export const SEED_BYTES = 32;

export function createDrbg(seed: Uint8Array, label: string): Drbg {
  if (seed.byteLength !== SEED_BYTES) {
    throw new Error(`seed must be ${String(SEED_BYTES)} bytes; got ${String(seed.byteLength)}`);
  }
  const key = Buffer.from(seed);
  const labelBytes = Buffer.from(label, 'utf8');
  let counter = 0;
  let block: Buffer = Buffer.alloc(0);
  let offset = block.byteLength;
  const refill = (): void => {
    const message = Buffer.concat([labelBytes, encodeCounter(counter)]);
    block = createHmac('sha256', key).update(message).digest();
    offset = 0;
    counter += 1;
  };
  const nextUint32 = (): number => {
    if (offset + 4 > block.byteLength) refill();
    const value = block.readUInt32BE(offset);
    offset += 4;
    return value;
  };
  const nextInt = (exclusiveMax: number): number => {
    if (!Number.isInteger(exclusiveMax) || exclusiveMax < 1 || exclusiveMax > 0x100000000) {
      throw new Error('exclusiveMax must be an integer in 1..2^32');
    }
    // Rejection sampling keeps the distribution flat even when exclusiveMax does not divide
    // 2^32 evenly; it stays deterministic because the stream is.
    const limit = Math.floor(0x100000000 / exclusiveMax) * exclusiveMax;
    for (;;) {
      const value = nextUint32();
      if (value < limit) return value % exclusiveMax;
    }
  };
  const intBetween = (low: number, high: number): number => {
    if (high < low) throw new Error('high must be at least low');
    return low + nextInt(high - low + 1);
  };
  return { nextUint32, nextInt, intBetween };
}

// Labels are joined with "/" (04 §5.4: secret/shared, secret/<playerKey>, leafFall/<k>, …).
// A label part may not contain "/" itself, so two different label lists never collide.
export function roundRng(seed: Uint8Array): RoundRng {
  return {
    child: (...labels) => {
      if (labels.length === 0 || labels.some((l) => l.length === 0 || l.includes('/'))) {
        throw new Error('labels must be non-empty and free of "/"');
      }
      return createDrbg(seed, labels.join('/'));
    },
  };
}

function encodeCounter(counter: number): Buffer {
  const buffer = Buffer.alloc(8);
  // High 32 bits stay zero: 2^32 blocks of 32 bytes per label is far more than a round uses.
  buffer.writeUInt32BE(0, 0);
  buffer.writeUInt32BE(counter, 4);
  return buffer;
}
