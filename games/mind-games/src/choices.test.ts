/**
 * @file   games/mind-games/src/choices.test.ts
 * @module games/mind-games
 * @brief  The winning options: every row of 02e §8.1, and MG4 against a brute-force reference.
 *
 * Responsibility: the table of 02e §8.1 row by row (shared places, a place that does not
 *                 exist, options nobody chose, All, a single chosen option); MG4 (09 §3): for
 *                 every count vector of four and five options with counts 0–4 and every winner
 *                 place, the winners equal those of a reference written the long way (each
 *                 chosen option's place is one more than the number of distinct smaller
 *                 counts among the chosen options).
 * Depends on:     vitest, ./choices
 * Spec:           docs/spec/02e-game-mind-games.md §8; docs/spec/09-testing-strategy.md §3 (MG4)
 */
import { describe, expect, it } from 'vitest';

import { CHOICES, countsOf, pointsOf, winnersOf, type Choice, type Counts } from './choices.js';

// Counts in option order: spring, summer, autumn, winter, all (0 when left out).
const vector = (v: readonly number[]): Counts => ({
  spring: v[0] ?? 0,
  summer: v[1] ?? 0,
  autumn: v[2] ?? 0,
  winter: v[3] ?? 0,
  all: v[4] ?? 0,
});

describe('the winning options of 02e §8.1', () => {
  it.each([
    [vector([3, 5, 3, 9]), 1, ['spring', 'autumn']],
    [vector([3, 5, 3, 9]), 2, ['summer']],
    [vector([3, 5, 3, 9]), 3, ['winter']],
    [vector([3, 5, 3, 9]), 4, []],
    [vector([0, 4, 2, 0]), 1, ['autumn']],
    [vector([0, 4, 2, 0]), 2, ['summer']],
    [vector([2, 2, 2, 2, 1]), 1, ['all']],
    [vector([2, 2, 2, 2, 1]), 2, ['spring', 'summer', 'autumn', 'winter']],
    [vector([5, 0, 0, 0]), 1, ['spring']],
    [vector([0, 0, 0, 0]), 1, []],
  ])('%o at place %i', (counts, place, winners) => {
    expect(winnersOf(counts, place)).toEqual(winners);
  });

  it('scores a winning season 1, a winning All 2, a losing choice 0', () => {
    expect(pointsOf('spring', ['spring', 'all'])).toBe(1);
    expect(pointsOf('all', ['spring', 'all'])).toBe(2);
    expect(pointsOf('winter', ['spring', 'all'])).toBe(0);
  });

  it('counts final choices per option', () => {
    expect(countsOf(['winter', 'all', 'winter'])).toEqual(vector([0, 0, 0, 2, 1]));
  });
});

// The reference: places from the distinct smaller counts, with a loop instead of a sort.
function reference(counts: Counts, options: readonly Choice[], place: number): Choice[] {
  const chosen = options.filter((c) => counts[c] > 0);
  return chosen.filter((c) => {
    const smaller = new Set(chosen.map((o) => counts[o]).filter((n) => n < counts[c]));
    return smaller.size + 1 === place;
  });
}

// Every vector of `n` counts from 0 to `max`.
function* vectors(n: number, max: number): Generator<number[]> {
  if (n === 0) {
    yield [];
    return;
  }
  for (const rest of vectors(n - 1, max)) for (let k = 0; k <= max; k++) yield [...rest, k];
}

describe('MG4 Winners (09 §3)', () => {
  it('equals the brute-force reference for four and five options and every place', () => {
    for (const options of [CHOICES.slice(0, 4), CHOICES]) {
      for (const v of vectors(options.length, 4)) {
        const counts = vector(v);
        for (let place = 1; place <= 5; place++) {
          expect(winnersOf(counts, place)).toEqual(reference(counts, options, place));
        }
      }
    }
  });
});
