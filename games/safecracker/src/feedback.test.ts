/**
 * @file   games/safecracker/src/feedback.test.ts
 * @module games/safecracker
 * @brief  The feedback rule and the tier table: worked example, edge cases, properties, boundaries.
 *
 * Responsibility: the worked example of 02b §5.1 and edge cases (all digits equal, all
 *                 different, lengths 3 and 6, four digits); against a brute-force reference that
 *                 pairs unmatched positions one by one; exact + near ≤ L, exact = L iff equal,
 *                 symmetry, near = multiset intersection − exact; every tier at its boundaries,
 *                 2 exact + 2 near at length 4 burning, and every tier reachable at length 4.
 * Depends on:     vitest, fast-check, ./feedback
 * Spec:           docs/spec/02b-game-safecracker.md §5.1, §6; docs/spec/09-testing-strategy.md §4.1
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { feedbackFor, tierOf } from './feedback.js';

const answer = (g: string, s: string) => {
  const { exact, near } = feedbackFor(g, s);
  return [exact, near];
};

// Reference: count exact positions, then pair each unmatched guess digit with the first
// unmatched, unused secret position holding the same digit.
function reference(g: string, s: string): [number, number] {
  const used = Array.from(s).map((d, i) => d === g[i]);
  const exact = used.filter(Boolean).length;
  let near = 0;
  for (let i = 0; i < g.length; i += 1) {
    if (g[i] === s[i]) continue;
    const j = Array.from(s).findIndex((d, k) => !used[k] && d === g[i]);
    if (j >= 0) {
      used[j] = true;
      near += 1;
    }
  }
  return [exact, near];
}

const pair = fc.integer({ min: 3, max: 6 }).chain((len) =>
  fc.integer({ min: 4, max: 10 }).chain((digits) => {
    const code = fc
      .array(fc.integer({ min: 0, max: digits - 1 }), { minLength: len, maxLength: len })
      .map((ds) => ds.join(''));
    return fc.tuple(code, code);
  }),
);

describe('the feedback rule', () => {
  it('answers the worked example of 02b §5.1', () => {
    expect(answer('1312', '1123')).toEqual([1, 3]);
    expect(answer('1111', '1123')).toEqual([2, 0]);
    expect(answer('2211', '1123')).toEqual([0, 3]);
    expect(answer('1123', '1123')).toEqual([4, 0]);
    expect(feedbackFor('1123', '1123').solved).toBe(true);
    expect(feedbackFor('1124', '1123').solved).toBe(false);
  });

  it('handles the edge cases', () => {
    expect(answer('7777', '7777')).toEqual([4, 0]);
    expect(answer('7777', '1234')).toEqual([0, 0]);
    expect(answer('4321', '1234')).toEqual([0, 4]);
    expect(answer('0123', '1230')).toEqual([0, 4]);
    expect(answer('012', '210')).toEqual([1, 2]);
    expect(answer('000000', '000001')).toEqual([5, 0]);
    expect(answer('123456', '654321')).toEqual([0, 6]);
    expect(answer('3210', '0123')).toEqual([0, 4]);
    expect(answer('0033', '3300')).toEqual([0, 4]);
  });

  it('agrees with the brute-force reference and its properties', () => {
    fc.assert(
      fc.property(pair, ([g, s]) => {
        const f = feedbackFor(g, s);
        expect([f.exact, f.near]).toEqual(reference(g, s));
        expect(f.exact + f.near).toBeLessThanOrEqual(g.length);
        expect(f.exact === g.length).toBe(g === s);
        expect(f.solved).toBe(g === s);
        expect(feedbackFor(s, g)).toEqual(f);
        const rest = Array.from(s);
        let common = 0;
        for (const d of g) {
          const k = rest.indexOf(d);
          if (k >= 0) {
            rest.splice(k, 1);
            common += 1;
          }
        }
        expect(f.near).toBe(common - f.exact);
      }),
      { numRuns: 1_000 },
    );
  });
});

const tier = (exact: number, near: number, length = 4) =>
  tierOf({ exact, near, solved: exact === length }, length);

describe('the tier table', () => {
  it('places the worked example and every boundary at length 4', () => {
    expect(tier(1, 3)).toBe('hot');
    expect(tier(2, 0)).toBe('warm');
    expect(tier(0, 3)).toBe('cool');
    expect(tier(2, 2)).toBe('burning');
    expect(tier(4, 0)).toBe('correct');
    expect(tier(3, 0)).toBe('justMissed');
    expect(tier(0, 0)).toBe('wayOff');
    // Score / 8: 1 → 0.125, 2 → 0.25 (cool), 3 → 0.375, 4 → 0.5 (warm), 5 → 0.625 (hot).
    expect(tier(0, 1)).toBe('cold');
    expect(tier(1, 0)).toBe('cool');
    expect(tier(0, 2)).toBe('cool');
    expect(tier(1, 1)).toBe('cool');
    expect(tier(0, 4)).toBe('warm');
    expect(tier(1, 2)).toBe('warm');
    expect(tier(2, 1)).toBe('hot');
  });

  it('keeps each boundary exact at other lengths', () => {
    // Length 5, score / 10: 0.2 cold, 0.4 cool, 0.5 warm, 0.6 hot, 0.7 hot, 0.8 burning.
    expect(tier(1, 0, 5)).toBe('cold');
    expect(tier(1, 2, 5)).toBe('cool');
    expect(tier(2, 1, 5)).toBe('warm');
    expect(tier(2, 2, 5)).toBe('hot');
    expect(tier(2, 3, 5)).toBe('hot');
    expect(tier(3, 2, 5)).toBe('burning');
    // Length 6, score / 12: 0.25 is cool, 0.45 = 5.4/12 so 5 is cool and 6 warm, 9 burning.
    expect(tier(0, 3, 6)).toBe('cool');
    expect(tier(1, 3, 6)).toBe('cool');
    expect(tier(3, 0, 6)).toBe('warm');
    expect(tier(3, 2, 6)).toBe('hot');
    expect(tier(3, 3, 6)).toBe('burning');
    expect(tier(2, 0, 3)).toBe('justMissed');
  });

  it('reaches every tier at the default length', () => {
    const seen = new Set<string>();
    for (let e = 0; e <= 4; e += 1) for (let n = 0; e + n <= 4; n += 1) seen.add(tier(e, n));
    expect(seen.size).toBe(8);
  });
});
