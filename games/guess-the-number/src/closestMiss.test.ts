/**
 * @file   games/guess-the-number/src/closestMiss.test.ts
 * @module games/guess-the-number
 * @brief  The closest miss of a shared round (O22): who, how far, ties, none, a hidden range.
 *
 * Responsibility: the smallest distance over the wrong guesses of everyone but the winner,
 *                 the winner's own misses left out; a tie goes to the earlier guess; none
 *                 without a winner or without another player's wrong guess; a guess outside a
 *                 hidden range counts by its plain distance; the result view carries it in
 *                 shared mode only and validates.
 * Depends on:     vitest, ./closestMiss, ./fakes, ./module
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/09-testing-strategy.md §2
 */
import { describe, expect, it } from 'vitest';

import { closestMiss } from './closestMiss.js';
import { input, Table } from './fakes.js';
import { guessTheNumber } from './module.js';

const shared = (value: number, rangeVisible = true) =>
  new Table({ mode: 'shared', value }, input('shared', ['a', 'b', 'c'], { rangeVisible }));

describe('the closest miss', () => {
  it('is the best wrong guess of anyone but the winner', () => {
    const t = shared(92);
    t.play('a', 91);
    t.play('b', 60);
    t.play('c', 95);
    t.play('a', 92);
    // a's own 91 is closer, but a won.
    expect(closestMiss(t.state, 92)).toEqual({ playerId: 'c', value: 95, distance: 3 });
  });

  it('goes to the earlier guess on a tie', () => {
    const t = shared(92);
    t.play('b', 94);
    t.play('c', 90);
    t.play('a', 92);
    expect(closestMiss(t.state, 92)).toEqual({ playerId: 'b', value: 94, distance: 2 });
  });

  it('is none without a winner, or when nobody else guessed wrong', () => {
    const open = shared(92);
    open.play('b', 91);
    expect(closestMiss(open.state, 92)).toBeNull();
    const alone = shared(92);
    alone.play('a', 50);
    alone.play('a', 92);
    expect(closestMiss(alone.state, 92)).toBeNull();
  });

  it('counts a guess outside a hidden range by its plain distance', () => {
    const t = shared(999, false);
    t.play('b', 1_004);
    t.play('c', 900);
    t.play('a', 999);
    expect(closestMiss(t.state, 999)).toEqual({ playerId: 'b', value: 1_004, distance: 5 });
  });

  it('is carried by the shared result view only', () => {
    const t = shared(92);
    t.play('b', 93);
    t.play('a', 92);
    const result = guessTheNumber.views.result(t.state, t.secrets);
    expect(result).toMatchObject({ closestMiss: { playerId: 'b', value: 93, distance: 1 } });
    expect(guessTheNumber.viewSchemas.result.safeParse(result).success).toBe(true);
    const ind = new Table(
      { mode: 'individual', byPlayer: { a: 92, b: 10 } },
      input('individual', ['a', 'b']),
    );
    ind.play('b', 93);
    ind.play('a', 92);
    expect(guessTheNumber.views.result(ind.state, ind.secrets)).toMatchObject({
      closestMiss: null,
    });
  });
});
