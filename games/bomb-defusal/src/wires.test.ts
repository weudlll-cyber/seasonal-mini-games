/**
 * @file   games/bomb-defusal/src/wires.test.ts
 * @module games/bomb-defusal
 * @brief  The feedback rule against a brute-force reference, and the tier rule at every cut count.
 *
 * Responsibility: the answer is the longest correct start (a right wire after a wrong one
 *                 counts nothing), defused exactly at `k = cuts`, checked against a reference
 *                 that tries every start length; the worked example of 02c §5.1; the tier table
 *                 of 02c §7 for cuts 3–6 exactly, every tier reachable; the palette and the
 *                 sequence schema.
 * Depends on:     vitest, fast-check, ./wires
 * Spec:           docs/spec/02c-game-bomb-defusal.md §3, §5.1, §7; docs/spec/09-testing-strategy.md §4.1
 */
import { TIERS } from '@smg/guess-engine';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  answerOf,
  inPaletteOrder,
  PALETTE,
  sameSequence,
  sequenceSchema,
  sequenceText,
  tierOf,
  wiresOf,
  type Sequence,
} from './wires.js';

// Two orders of `n` different wires of the first `w` colours.
const pair = fc
  .record({ w: fc.integer({ min: 4, max: 8 }), n: fc.integer({ min: 3, max: 6 }) })
  .filter(({ w, n }) => n <= w)
  .chain(({ w, n }) => {
    const order = fc.shuffledSubarray(wiresOf(w), { minLength: n, maxLength: n });
    return fc.tuple(order, order);
  });

// The reference: the largest k for which every one of the first k places agrees.
function reference(g: Sequence, s: Sequence): number {
  let best = 0;
  for (let k = 0; k <= s.length; k += 1) {
    if (g.slice(0, k).every((w, i) => w === s[i])) best = k;
  }
  return best;
}

describe('the feedback rule', () => {
  it('is the longest correct start, as the brute-force reference says', () => {
    fc.assert(
      fc.property(pair, ([g, s]) => {
        const f = answerOf(g, s);
        expect(f.correct).toBe(reference(g, s));
        expect(f.defused).toBe(sameSequence(g, s));
      }),
      { numRuns: 1_000 },
    );
  });

  it('answers the worked example of 02c §5.1', () => {
    const secret: Sequence = ['red', 'blue', 'yellow', 'white'];
    expect(answerOf(['red', 'blue', 'green', 'white'], secret)).toEqual({
      correct: 2,
      defused: false,
    });
    expect(answerOf(['blue', 'red', 'yellow', 'white'], secret).correct).toBe(0);
    expect(answerOf(['red', 'blue', 'yellow', 'black'], secret).correct).toBe(3);
    expect(answerOf(secret, secret)).toEqual({ correct: 4, defused: true });
  });

  it('counts nothing after the first wrong cut', () => {
    expect(
      answerOf(['green', 'blue', 'yellow', 'white'], ['red', 'blue', 'yellow', 'white']),
    ).toEqual({ correct: 0, defused: false });
  });
});

describe('the tier rule (02c §7)', () => {
  const table: Record<number, readonly string[]> = {
    3: ['wayOff', 'cold', 'justMissed', 'correct'],
    4: ['wayOff', 'cold', 'burning', 'justMissed', 'correct'],
    5: ['wayOff', 'cold', 'warm', 'burning', 'justMissed', 'correct'],
    6: ['wayOff', 'cold', 'cool', 'hot', 'burning', 'justMissed', 'correct'],
  };

  it('gives exactly the table for 3 to 6 cuts', () => {
    for (const [cuts, tiers] of Object.entries(table)) {
      expect(tiers.map((_, k) => tierOf(k, Number(cuts)))).toEqual(tiers);
    }
  });

  it('reaches every tier at some number of cuts', () => {
    const reached = new Set(Object.values(table).flat());
    expect([...reached].sort()).toEqual([...TIERS].sort());
  });
});

describe('wires and sequences', () => {
  it('takes the first colours of the palette, and orders any set by it', () => {
    expect(wiresOf(4)).toEqual(['red', 'blue', 'yellow', 'green']);
    expect(wiresOf(8)).toEqual([...PALETTE]);
    expect(inPaletteOrder(['purple', 'red', 'white'])).toEqual(['red', 'white', 'purple']);
  });

  it('takes only palette names, at most six, and words a sequence', () => {
    expect(sequenceSchema.safeParse(['red', 'blue']).success).toBe(true);
    expect(sequenceSchema.safeParse(['red', 'pink']).success).toBe(false);
    expect(sequenceSchema.safeParse([1, 2]).success).toBe(false);
    expect(sequenceSchema.safeParse(Array<string>(7).fill('red')).success).toBe(false);
    expect(sequenceText(['red', 'blue', 'green'])).toBe('red → blue → green');
  });

  it('compares sequences by order', () => {
    expect(sameSequence(['red', 'blue'], ['red', 'blue'])).toBe(true);
    expect(sameSequence(['red', 'blue'], ['blue', 'red'])).toBe(false);
    expect(sameSequence(['red', 'blue'], ['red', 'blue', 'green'])).toBe(false);
  });
});
