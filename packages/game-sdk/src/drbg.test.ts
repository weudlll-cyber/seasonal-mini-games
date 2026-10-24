/**
 * @file   packages/game-sdk/src/drbg.test.ts
 * @module game-sdk
 * @brief  The DRBG is deterministic, label-separated and uniform; roundRng hides the seed.
 *
 * Responsibility: same seed and label give the same stream, different labels independent
 *                 ones; intBetween stays inside its bounds; a chi-square smoke test over
 *                 100 000 draws guards uniformity (05 §4); label rules of roundRng.
 * Depends on:     vitest, fast-check, ./drbg
 * Spec:           docs/spec/05-security-threat-model.md §4; docs/spec/09-testing-strategy.md §3 G7
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createDrbg, roundRng, SEED_BYTES } from './drbg.js';

const seed = (n: number): Uint8Array => new Uint8Array(SEED_BYTES).fill(n);

describe('DRBG', () => {
  it('gives the same stream for the same seed and label, another for another label', () => {
    const a = createDrbg(seed(1), 'x');
    const b = createDrbg(seed(1), 'x');
    const c = createDrbg(seed(1), 'y');
    const sa = Array.from({ length: 20 }, () => a.nextUint32());
    expect(Array.from({ length: 20 }, () => b.nextUint32())).toEqual(sa);
    expect(Array.from({ length: 20 }, () => c.nextUint32())).not.toEqual(sa);
  });

  it('keeps intBetween inside its bounds, both inclusive', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 255 }), fc.integer(), fc.nat(10_000), (s, lo, span) => {
        const low = lo % 1_000_000;
        const v = createDrbg(seed(s), 'b').intBetween(low, low + span);
        return v >= low && v <= low + span;
      }),
    );
  });

  it('is uniform over a range that does not divide 2^32 (chi-square smoke test)', () => {
    const drbg = createDrbg(seed(7), 'uniform');
    const buckets = 1_000;
    const draws = 100_000;
    const counts = new Array<number>(buckets).fill(0);
    for (let i = 0; i < draws; i += 1) {
      const v = drbg.intBetween(1, buckets) - 1;
      counts[v] = (counts[v] ?? 0) + 1;
    }
    const expected = draws / buckets;
    const chi = counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
    // 999 degrees of freedom: the 0.999 quantile is about 1 143.
    expect(chi).toBeLessThan(1_143);
  });

  it('refuses a seed of the wrong length and impossible bounds', () => {
    expect(() => createDrbg(new Uint8Array(16), 'x')).toThrow();
    expect(() => createDrbg(seed(1), 'x').intBetween(5, 4)).toThrow();
    expect(() => createDrbg(seed(1), 'x').nextInt(0)).toThrow();
  });
});

describe('roundRng', () => {
  it('joins labels with "/" and refuses parts that could collide', () => {
    const rng = roundRng(seed(3));
    const viaRng = rng.child('secret', 'p1').nextUint32();
    expect(viaRng).toBe(createDrbg(seed(3), 'secret/p1').nextUint32());
    expect(() => rng.child('a/b')).toThrow();
    expect(() => rng.child()).toThrow();
    expect(() => rng.child('')).toThrow();
  });
});
