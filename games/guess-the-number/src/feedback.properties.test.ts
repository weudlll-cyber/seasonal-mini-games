/**
 * @file   games/guess-the-number/src/feedback.properties.test.ts
 * @module games/guess-the-number
 * @brief  Property tests of the feedback rule, the band and accepted guesses (G5, G6).
 *
 * Responsibility: G5 feedback is higher / lower / correct as 02 §6.1 defines it, and the band
 *                 is exactly the values every answer allows inside the range (so it always
 *                 holds the secret); G6 every accepted guess is a whole number inside the
 *                 range, not removed and not guessed before by that player. Answers about
 *                 different secrets leave the last non-empty band.
 * Depends on:     vitest, fast-check, ./fakes, ./feedback
 * Spec:           docs/spec/09-testing-strategy.md §3 G5, G6; docs/spec/02-game-guess-the-number.md §6.1
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { input, Table } from './fakes.js';
import { band, feedbackFor } from './feedback.js';

const LOW = 1;
const HIGH = 100;

const round = fc.record({
  secret: fc.integer({ min: LOW, max: HIGH }),
  removed: fc.uniqueArray(fc.integer({ min: LOW, max: HIGH }), { maxLength: 20 }),
  guesses: fc.array(fc.integer({ min: LOW - 5, max: HIGH + 5 }), { maxLength: 25 }),
});

describe('feedback and bands', () => {
  it('G5: answers follow 02 §6.1 and the band is exactly what they allow', () => {
    fc.assert(
      fc.property(round, ({ secret, guesses }) => {
        const range = { low: LOW, high: HIGH };
        const inside = guesses.filter((g) => g >= LOW && g <= HIGH);
        const answers = inside.map((value) => ({ value, feedback: feedbackFor(value, secret) }));
        for (const a of answers) {
          const want = a.value < secret ? 'higher' : a.value > secret ? 'lower' : 'correct';
          expect(a.feedback).toBe(want);
        }
        const b = band(range, answers);
        for (let v = LOW; v <= HIGH; v += 1) {
          const allowed = answers.every((a) => feedbackFor(a.value, v) === a.feedback);
          expect(v >= b.low && v <= b.high).toBe(allowed);
        }
      }),
      { numRuns: 1_000 },
    );
  });

  it('G6: accepted guesses are whole, in range, not removed and not repeated', () => {
    fc.assert(
      fc.property(round, ({ secret, removed, guesses }) => {
        const t = new Table(
          { mode: 'shared', value: secret },
          input('shared', ['a'], { rangeLow: LOW, rangeHigh: HIGH }),
        );
        t.state = { ...t.state, removed: [...removed].sort((x, y) => x - y) };
        const accepted: number[] = [];
        for (const g of guesses) {
          if (t.play('a', g).ok) accepted.push(g);
        }
        for (const [i, g] of accepted.entries()) {
          expect(Number.isInteger(g) && g >= LOW && g <= HIGH).toBe(true);
          expect(removed.includes(g)).toBe(false);
          expect(accepted.indexOf(g)).toBe(i);
        }
        expect(t.state.players.a?.band).toEqual(
          band({ low: LOW, high: HIGH }, t.state.players.a?.guesses ?? []),
        );
      }),
      { numRuns: 100 },
    );
  });

  it('keeps the last non-empty band when answers contradict each other', () => {
    const answers = [
      { value: 10, feedback: 'higher' as const },
      { value: 5, feedback: 'lower' as const },
    ];
    expect(band({ low: 1, high: 20 }, answers)).toEqual({ low: 11, high: 20 });
  });
});
