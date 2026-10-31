/**
 * @file   games/guess-the-number/src/closeness.test.ts
 * @module games/guess-the-number
 * @brief  The closeness tier: its boundaries, its order, "just missed", and a hidden range.
 *
 * Responsibility: each threshold falls on the side 02 §6.3 gives it; the tier never gets
 *                 farther as a guess gets closer (property); 1 or 2 away is "just missed" in
 *                 any range; a guess outside a hidden range is "way off" however close; the
 *                 trend compares tiers only (T71).
 * Depends on:     vitest, fast-check, ./closeness
 * Spec:           docs/spec/02-game-guess-the-number.md §6.3
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { tierOf, TIERS, trendOf, type Thresholds } from './closeness.js';

const T: Thresholds = { wayOff: 50, cold: 25, cool: 10, warm: 3, hot: 1 };
const WIDE = { low: 0, high: 1_000 };

describe('tierOf', () => {
  it('puts each distance on the right side of its threshold', () => {
    const at = (value: number) => tierOf(value, 0, WIDE, T);
    expect([0, 1, 2, 3].map(at)).toEqual(['correct', 'justMissed', 'justMissed', 'burning']);
    // 1 % of 1 000 is 10: at the threshold it is still burning, just over it hot.
    expect([10, 11, 30, 31].map(at)).toEqual(['burning', 'hot', 'hot', 'warm']);
    expect([100, 101, 250, 251].map(at)).toEqual(['warm', 'cool', 'cool', 'cold']);
    expect([500, 501, 1_000].map(at)).toEqual(['cold', 'wayOff', 'wayOff']);
  });

  it('means the same in a small and in a huge range', () => {
    // 11 % and 12.5 % of the width.
    expect(tierOf(61, 50, { low: 1, high: 101 }, T)).toBe('cool');
    expect(tierOf(250_000, 0, { low: -1_000_000, high: 1_000_000 }, T)).toBe('cool');
  });

  it('calls 1 or 2 away "just missed" even where that is a large share of the range', () => {
    const tiny = { low: 1, high: 10 };
    expect(tierOf(3, 1, tiny, T)).toBe('justMissed');
    expect(tierOf(4, 1, tiny, T)).toBe('cold');
  });

  it('calls a guess outside a hidden range way off, however close to the secret', () => {
    const hidden = { low: 1, high: 100 };
    expect(tierOf(101, 100, hidden, T)).toBe('wayOff');
    expect(tierOf(-900_000_000, 1, hidden, T)).toBe('wayOff');
  });

  it('never gets farther as a guess gets closer', () => {
    const rank = (value: number, secret: number) => TIERS.indexOf(tierOf(value, secret, WIDE, T));
    const n = fc.integer({ min: WIDE.low, max: WIDE.high });
    fc.assert(
      fc.property(n, n, n, (secret, a, b) => {
        const [near, far] = Math.abs(a - secret) <= Math.abs(b - secret) ? [a, b] : [b, a];
        expect(rank(near, secret)).toBeGreaterThanOrEqual(rank(far, secret));
      }),
    );
  });
});

describe('trendOf', () => {
  it('compares tiers only', () => {
    expect(trendOf('cold', 'warm')).toBe('closer');
    expect(trendOf('hot', 'cool')).toBe('farther');
    expect(trendOf('warm', 'warm')).toBeNull();
  });
});
