/**
 * @file   games/guess-the-number/src/closest.test.ts
 * @module games/guess-the-number
 * @brief  "Closest to winning" (O110): each player's best guess by its distance to the number.
 *
 * Responsibility: the module's `closest` names one best guess per player who guessed, by the
 *                 plain distance to the shared number or, in individual mode, to the player's
 *                 own; a solve is 0; equal ones keep the earlier guess; a player without a
 *                 guess is left out. The order is the platform's (packages/domain closest).
 * Depends on:     vitest, ./fakes, ./module
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/04-software-architecture.md §4
 */
import { describe, expect, it } from 'vitest';

import { input, Table } from './fakes.js';
import { guessTheNumber } from './module.js';

const closest = (t: Table) => guessTheNumber.closest?.(t.state, t.secrets) ?? null;

describe('closest to winning', () => {
  it('names each player once with their best guess, a solve as 0, the earlier on a tie', () => {
    const t = new Table({ mode: 'shared', value: 92 }, input('shared', ['a', 'b', 'c', 'd']));
    t.play('a', 50);
    t.play('b', 94);
    t.play('a', 91);
    t.play('b', 90);
    t.play('c', 92);
    expect(closest(t)).toEqual([
      { playerId: 'a', index: 1, distance: 1, receiveSeq: 3 },
      // 94 and 90 are both 2 away: the earlier one stands.
      { playerId: 'b', index: 0, distance: 2, receiveSeq: 2 },
      { playerId: 'c', index: 0, distance: 0, receiveSeq: 5 },
    ]);
  });

  it('measures each player against their own number in individual mode', () => {
    const secrets = { mode: 'individual' as const, byPlayer: { a: 10, b: 500 } };
    const t = new Table(secrets, input('individual', ['a', 'b']));
    t.play('a', 12);
    t.play('b', 400);
    t.play('b', 499);
    expect(closest(t)).toEqual([
      { playerId: 'a', index: 0, distance: 2, receiveSeq: 1 },
      { playerId: 'b', index: 1, distance: 1, receiveSeq: 3 },
    ]);
  });
});
