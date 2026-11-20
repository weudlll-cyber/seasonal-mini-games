/**
 * @file   packages/domain/src/round/closest.test.ts
 * @module domain/round
 * @brief  The order of "Closest to winning" (O110): placed first, then by distance, ten rows.
 *
 * Responsibility: shared mode: the winner first, then the others by the distance of their best
 *                 guess; individual mode: the solvers in their placings' order (not by their
 *                 distance or their guess's time), then the others; equal distances by the
 *                 earlier guess; at most ten rows; fewer players, fewer rows; a player
 *                 without a best guess is not listed.
 * Depends on:     vitest, ./closest
 * Spec:           docs/spec/02-game-guess-the-number.md §9
 */
import type { BestGuess } from '@smg/game-sdk';
import { describe, expect, it } from 'vitest';

import { CLOSEST_ROWS, closestToWinning } from './closest.js';

const best = (playerId: string, distance: number, receiveSeq: number): BestGuess => ({
  playerId,
  index: 0,
  distance,
  receiveSeq,
});
const ids = (rows: readonly BestGuess[]) => rows.map((r) => r.playerId);

describe('closest to winning', () => {
  it('puts the shared winner first, then the others closest first, the earlier on a tie', () => {
    const rows = closestToWinning(
      [best('a', 13, 1), best('w', 0, 9), best('b', 1, 7), best('c', 13, 4)],
      [
        { playerId: 'w', place: 1 },
        { playerId: 'a', place: null },
        { playerId: 'b', place: null },
        { playerId: 'c', place: null },
        { playerId: 'idle', place: null },
      ],
    );
    expect(ids(rows)).toEqual(['w', 'b', 'a', 'c']);
  });

  it('lists individual solvers by their placings, then the others', () => {
    const rows = closestToWinning(
      [best('late', 0, 2), best('first', 0, 8), best('near', 1, 1), best('far', 50, 3)],
      [
        { playerId: 'first', place: 1 },
        { playerId: 'late', place: 2 },
        { playerId: 'near', place: null },
        { playerId: 'far', place: null },
      ],
    );
    expect(ids(rows)).toEqual(['first', 'late', 'near', 'far']);
  });

  it('shows at most ten rows, and fewer with fewer players', () => {
    const many = Array.from({ length: 14 }, (_, i) => best(`p${String(i)}`, 14 - i, i));
    const rows = closestToWinning(many, []);
    expect(rows).toHaveLength(CLOSEST_ROWS);
    expect(rows[0]?.playerId).toBe('p13');
    expect(closestToWinning([best('x', 3, 1)], [])).toHaveLength(1);
    expect(closestToWinning([], [])).toEqual([]);
  });
});
