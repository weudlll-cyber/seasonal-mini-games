/**
 * @file   packages/guess-engine/src/closestMiss.ts
 * @module guess-engine
 * @brief  The closest miss of a shared round (O22), or on a time-up result its closest guess.
 *
 * Responsibility: at the round's end, the smallest distance (the game's measure) over every
 *                 wrong accepted guess of the players other than the winner (the player of the
 *                 first correct guess in receive order); a tie goes to the earlier receive
 *                 order. Without a winner (time up), the closest guess of the round over every
 *                 player (T145); none when nobody else guessed. Only result views call it, so it never leaves the server before the round has ended.
 * Depends on:     ./state (types)
 * Used by:        ./index, games/* (their result view)
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/04-software-architecture.md §4.7
 */
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
