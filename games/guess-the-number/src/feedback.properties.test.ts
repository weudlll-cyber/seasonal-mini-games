/**
 * @file   games/guess-the-number/src/feedback.properties.test.ts
 * @module games/guess-the-number
 * @brief  Property tests of the feedback rule and accepted guesses (G5, G6).
 *
 * Responsibility: G5 feedback is higher / lower / correct as 02 §6.1 defines it, and no answer
 *                 carries a narrowed range (O17); G6 every accepted guess is a whole number
 *                 inside the range when it is shown (any whole number when it is hidden), not
 *                 removed and not guessed before by that player.
 * Depends on:     vitest, fast-check, ./fakes, ./feedback
 * Spec:           docs/spec/09-testing-strategy.md §3 G5, G6; docs/spec/02-game-guess-the-number.md §6.1
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { input, Table } from './fakes.js';
import { feedbackFor } from './feedback.js';

const LOW = 1;
const HIGH = 100;

const round = fc.record({
  secret: fc.integer({ min: LOW, max: HIGH }),
  removed: fc.uniqueArray(fc.integer({ min: LOW, max: HIGH }), { maxLength: 20 }),
  guesses: fc.array(fc.integer({ min: LOW - 5, max: HIGH + 5 }), { maxLength: 25 }),
});

describe('feedback and accepted guesses', () => {
  it('G5: answers follow 02 §6.1 and carry nothing narrowed', () => {
    fc.assert(
      fc.property(round, fc.boolean(), ({ secret, guesses }, rangeVisible) => {
        const t = new Table(
          { mode: 'shared', value: secret },
          input('shared', ['a'], { rangeLow: LOW, rangeHigh: HIGH, rangeVisible }),
        );
        for (const value of guesses) {
          const d = t.play('a', value);
          if (!d.ok) continue;
          const want = value < secret ? 'higher' : value > secret ? 'lower' : 'correct';
          expect(feedbackFor(value, secret)).toBe(want);
          expect(d.events[0]?.event).toMatchObject({ value, feedback: want });
          const keys = d.events.flatMap((e) => Object.keys(e.event as object));
          expect(keys.some((k) => /band|range/i.test(k))).toBe(false);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('G6: accepted guesses are whole, in a shown range, not removed and not repeated', () => {
    fc.assert(
      fc.property(round, fc.boolean(), ({ secret, removed, guesses }, rangeVisible) => {
        const t = new Table(
          { mode: 'shared', value: secret },
          input('shared', ['a'], { rangeLow: LOW, rangeHigh: HIGH, rangeVisible }),
        );
        t.state = { ...t.state, removed: [...removed].sort((x, y) => x - y) };
        const accepted: number[] = [];
        for (const g of guesses) {
          if (t.play('a', g).ok) accepted.push(g);
        }
        for (const [i, g] of accepted.entries()) {
          expect(Number.isInteger(g)).toBe(true);
          if (rangeVisible) expect(g >= LOW && g <= HIGH).toBe(true);
          expect(removed.includes(g)).toBe(false);
          expect(accepted.indexOf(g)).toBe(i);
        }
        // Hidden: every new number that did not fall is taken, inside the range or not.
        const fresh = guesses.filter((g, i) => guesses.indexOf(g) === i && !removed.includes(g));
        if (!rangeVisible) expect(accepted).toEqual(fresh);
      }),
      { numRuns: 200 },
    );
  });
});
