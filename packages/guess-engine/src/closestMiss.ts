/**
 * @file   packages/guess-engine/src/closestMiss.ts
 * @module guess-engine
 * @brief  The closest miss of a shared round (O22), or on a time-up result its closest guess;
 *         each player's best guess (O110).
 *
 * Responsibility: at the round's end, the smallest distance (the game's measure) over every
 *                 wrong accepted guess of the players other than the winner (the player of the
 *                 first correct guess in receive order); a tie goes to the earlier receive
 *                 order. Without a winner (time up), the closest guess of the round over every
 *                 player (T145); none when nobody else guessed. Each player's best guess for
 *                 the result's "Closest to winning" (`bestGuessesBy`, O110): the smallest
 *                 distance of their guesses, the earlier on a tie; a player without a guess
 *                 has none. Only result views and the module's `closest` call them, so
 *                 nothing leaves the server before the round has ended.
 * Depends on:     @smg/game-sdk (BestGuess), ./state (types)
 * Used by:        ./index, ./module (`closest`), games/* (their result view)
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/04-software-architecture.md §4.7
 */
import type { BestGuess } from '@smg/game-sdk';

import type { Guess, GuessBase } from './state.js';

export interface ClosestMiss<V> {
  readonly playerId: string;
  readonly value: V;
  readonly distance: number;
}

export function closestMissBy<V, F>(
  state: GuessBase<V, F>,
  solved: (feedback: F) => boolean,
  distance: (g: Guess<V, F>) => number,
): ClosestMiss<V> | null {
  const all = Object.entries(state.players).flatMap(([playerId, p]) =>
    p.guesses.map((g) => ({ playerId, g })),
  );
  // The winner: the first correct guess in receive order (02 §8.1).
  const winner = all
    .filter((x) => solved(x.g.feedback))
    .sort((x, y) => x.g.receiveSeq - y.g.receiveSeq)[0];
  let best: { playerId: string; g: Guess<V, F>; distance: number } | null = null;
  for (const x of all) {
    if (x.playerId === winner?.playerId || solved(x.g.feedback)) continue;
    const d = distance(x.g);
    const closer =
      best === null ||
      d < best.distance ||
      (d === best.distance && x.g.receiveSeq < best.g.receiveSeq);
    if (closer) best = { ...x, distance: d };
  }
  return best === null
    ? null
    : { playerId: best.playerId, value: best.g.value, distance: best.distance };
}

// Each player's best guess (O110): the smallest distance, the earlier guess on a tie (the
// guesses are in receive order, so the first of equal ones is kept).
export function bestGuessesBy<V, F>(
  state: GuessBase<V, F>,
  distance: (g: Guess<V, F>, playerId: string) => number,
): BestGuess[] {
  return Object.entries(state.players).flatMap(([playerId, p]) => {
    const rated = p.guesses.map((g, index) => ({
      playerId,
      index,
      distance: distance(g, playerId),
      receiveSeq: g.receiveSeq,
    }));
    const best = rated.reduce<BestGuess | null>(
      (b, r) => (b === null || r.distance < b.distance ? r : b),
      null,
    );
    return best === null ? [] : [best];
  });
}
