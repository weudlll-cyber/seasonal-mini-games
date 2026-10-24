/**
 * @file   games/guess-the-number/src/secrets.test.ts
 * @module games/guess-the-number
 * @brief  Secrets come from the seed alone, stay in the range and are uniform.
 *
 * Responsibility: the same seed gives the same secrets and another seed others; the shared
 *                 secret and each player's are separated by label; every secret lies in the
 *                 configured range; over many seeds the secrets are uniform (G7, chi-square
 *                 smoke test); asking for a player without a secret fails loudly.
 * Depends on:     vitest, @smg/game-sdk/crypto, ./fakes, ./secrets
 * Spec:           docs/spec/04-software-architecture.md §5.4, docs/spec/09-testing-strategy.md §3 G7
 */
import { roundRng } from '@smg/game-sdk/crypto';
import { describe, expect, it } from 'vitest';

import { input } from './fakes.js';
import { deriveSecrets, secretOf } from './secrets.js';

const seed = (n: number) => new Uint8Array(32).fill(n);

describe('secrets', () => {
  it('follow the seed and are separated by label', () => {
    const players = ['a', 'b', 'c'];
    const one = deriveSecrets(input('individual', players), roundRng(seed(1)));
    expect(deriveSecrets(input('individual', players), roundRng(seed(1)))).toEqual(one);
    expect(deriveSecrets(input('individual', players), roundRng(seed(2)))).not.toEqual(one);
    const values = players.map((p) => secretOf(one, p));
    expect(new Set(values).size).toBeGreaterThan(1);
    const sharedSecrets = deriveSecrets(input('shared', players), roundRng(seed(1)));
    expect(players.map((p) => secretOf(sharedSecrets, p))).toEqual(
      Array(3).fill(secretOf(sharedSecrets, 'a')),
    );
  });

  it('lie inside the configured range', () => {
    for (let n = 0; n < 50; n += 1) {
      const s = deriveSecrets(
        input('shared', ['a'], { rangeLow: 40, rangeHigh: 49 }),
        roundRng(seed(n)),
      );
      expect(secretOf(s, 'a')).toBeGreaterThanOrEqual(40);
      expect(secretOf(s, 'a')).toBeLessThanOrEqual(49);
    }
  });

  it('are uniform over the range (G7)', () => {
    const counts = new Array<number>(10).fill(0);
    const rounds = 5_000;
    for (let n = 0; n < rounds; n += 1) {
      const bytes = new Uint8Array(32);
      new DataView(bytes.buffer).setUint32(0, n);
      const s = deriveSecrets(
        input('shared', ['a'], { rangeLow: 1, rangeHigh: 10 }),
        roundRng(bytes),
      );
      const i = secretOf(s, 'a') - 1;
      counts[i] = (counts[i] ?? 0) + 1;
    }
    const expected = rounds / 10;
    const chi = counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
    // 9 degrees of freedom: p = 0.001 at 27.88.
    expect(chi).toBeLessThan(27.88);
  });

  it('refuse a player without a secret', () => {
    const s = deriveSecrets(input('individual', ['a']), roundRng(seed(1)));
    expect(() => secretOf(s, 'b')).toThrow('no secret for b');
  });
});
