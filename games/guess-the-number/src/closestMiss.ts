/**
 * @file   games/guess-the-number/src/closestMiss.ts
 * @module games/guess-the-number
 * @brief  The closest miss of a shared round: the best wrong guess of anyone but the winner (O22).
 *
 * Responsibility: at the round's end, the smallest |guess − secret| over every wrong accepted
 *                 guess of the players other than the winner (the player of the first correct
 *                 guess); a tie goes to the earlier receive order. None without a winner, or
 *                 when nobody else guessed wrong. Distance is plain, so a guess outside a
 *                 hidden range counts like any other. Only the result view calls it, so it
 *                 never leaves the server before the round has ended.
 * Depends on:     ./state (types)
 * Used by:        ./views, ./closestMiss.test
 * Spec:           docs/spec/02-game-guess-the-number.md §9
 */
import type { Guess, GtnState } from './state.js';

export interface ClosestMiss {
  readonly playerId: string;
  readonly value: number;
  readonly distance: number;
}

interface Placed {
  readonly playerId: string;
  readonly g: Guess;
}

export function closestMiss(state: GtnState, secret: number): ClosestMiss | null {
  const all: Placed[] = Object.entries(state.players).flatMap(([playerId, p]) =>
    p.guesses.map((g) => ({ playerId, g })),
  );
  // The winner: the first correct guess in receive order (02 §8.1).
  const winner = all
    .filter((x) => x.g.feedback === 'correct')
    .sort((x, y) => x.g.receiveSeq - y.g.receiveSeq)[0];
  if (winner === undefined) return null;
  let best: (Placed & { readonly distance: number }) | null = null;
  for (const x of all) {
    if (x.playerId === winner.playerId || x.g.feedback === 'correct') continue;
    const distance = Math.abs(x.g.value - secret);
    const closer =
      best === null ||
      distance < best.distance ||
      (distance === best.distance && x.g.receiveSeq < best.g.receiveSeq);
    if (closer) best = { ...x, distance };
  }
  return best === null
    ? null
    : { playerId: best.playerId, value: best.g.value, distance: best.distance };
}
