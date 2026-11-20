/**
 * @file   packages/domain/src/round/closest.ts
 * @module domain/round
 * @brief  "Closest to winning" of an ended round: ten players, each once, with their best guess.
 *
 * Responsibility: the owner's order (O110) over the best guesses a game names (`closest`):
 *                 the placed players first, by place (shared mode: the winner; individual
 *                 mode: the solvers in the order they solved), then everyone else by the
 *                 distance of their best guess, equal ones by the earlier guess. A player
 *                 without a guess is not listed; at most ten rows.
 * Depends on:     @smg/game-sdk (BestGuess), ./types
 * Used by:        ../index, packages/application (RoundSession)
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/04-software-architecture.md §4
 */
import type { BestGuess } from '@smg/game-sdk';

import type { PlayerResult } from './types.js';

// The rows "Closest to winning" shows (O110).
export const CLOSEST_ROWS = 10;

export function closestToWinning(
  best: readonly BestGuess[],
  results: readonly Pick<PlayerResult, 'playerId' | 'place'>[],
): BestGuess[] {
  const place = new Map(results.map((r) => [r.playerId, r.place ?? Infinity]));
  const placeOf = (b: BestGuess) => place.get(b.playerId) ?? Infinity;
  return [...best]
    .sort(
      (a, b) => placeOf(a) - placeOf(b) || a.distance - b.distance || a.receiveSeq - b.receiveSeq,
    )
    .slice(0, CLOSEST_ROWS);
}
