/**
 * @file   packages/guess-engine/src/candidates.ts
 * @module guess-engine
 * @brief  The shared parts of a Leaf Fall's candidate set (O37) and the uniform distinct draw.
 *
 * Responsibility: the guesses whose answers every player can see — a shared secret with
 *                 visibility `full`, answered before the Frost cut `releasedBefore` — or none
 *                 (`own`, `numbers`, individual mode: DECISIONS T111); the values guessed so far;
 *                 and `n` distinct values of a list chosen uniformly with the DRBG it is given
 *                 (a partial Fisher–Yates shuffle). Which values a game's candidates are, and
 *                 what a public answer rules out, is each game's own (numbers, digits, wires,
 *                 cells).
 * Depends on:     @smg/game-sdk (Drbg), ./state
 * Used by:        ./index, games/* (their Leaf Fall)
 * Spec:           docs/spec/03-seasonal-specials.md §2.3; docs/spec/04-software-architecture.md §4.7
 */
import type { Drbg } from '@smg/game-sdk';

import type { Guess, GuessBase } from './state.js';

// The answers every player can see; none where no answer is public.
export function publicGuesses<V, F>(state: GuessBase<V, F>, releasedBefore: number): Guess<V, F>[] {
  if (state.mode !== 'shared' || state.visibility !== 'full') return [];
  // A held answer counts once Frost delivers it, the same cut as the views' (T111).
  return Object.values(state.players).flatMap((p) =>
    p.guesses.filter((g) => g.receivedAt < releasedBefore),
  );
}

// Every accepted guess's value, player by player.
export const guessedValues = <V, F>(state: GuessBase<V, F>): V[] =>
  Object.values(state.players).flatMap((p) => p.guesses.map((g) => g.value));

// `n` distinct values from `pool`, uniformly: a partial Fisher–Yates shuffle (reorders `pool`).
export function pickDistinct<T>(pool: T[], n: number, rng: Drbg): T[] {
  for (let i = 0; i < n; i += 1) {
    const j = i + rng.nextInt(pool.length - i);
    const a = pool[i] as T;
    pool[i] = pool[j] as T;
    pool[j] = a;
  }
  return pool.slice(0, n);
}
