/**
 * @file   games/guess-the-number/src/closestMiss.ts
 * @module games/guess-the-number
 * @brief  The closest miss of a shared round, measured as the plain distance to the number (O22).
 *
 * Responsibility: the guess engine's closest miss (the best wrong guess of anyone but the
 *                 winner, the earlier on a tie, none without a winner) with this game's measure,
 *                 |guess − secret|, so a guess outside a hidden range counts like any other.
 *                 Only the result view calls it, so it never leaves the server before the end.
 * Depends on:     @smg/guess-engine (closestMissBy), ./state (types)
 * Used by:        ./views, ./closestMiss.test
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/04-software-architecture.md §4.7
 */
import { closestMissBy, type ClosestMiss } from '@smg/guess-engine';

import type { GtnState } from './state.js';

export const closestMiss = (state: GtnState, secret: number): ClosestMiss<number> | null =>
  closestMissBy(
    state,
    (feedback) => feedback === 'correct',
    (g) => Math.abs(g.value - secret),
  );
