/**
 * @file   games/guess-the-number/src/devBot.ts
 * @module games/guess-the-number
 * @brief  The development bot: guesses near the middle of its own band.
 *
 * Responsibility: from its player view only (never a secret), a number inside its band that
 *                 it has not guessed and that is not removed, near the middle so the search
 *                 halves, with a little spread so bots do not all guess alike. Used by the
 *                 Quick Test and the load driver's in-process twin (09 §5).
 * Depends on:     @smg/game-sdk (DevBot), ./rules
 * Used by:        ./index, games/registry
 * Spec:           docs/spec/09-testing-strategy.md §5
 */
import type { DevBot } from '@smg/game-sdk';

import type { GuessAction } from './rules.js';
import type { PlayerView } from './views.js';

export const gtnDevBot: DevBot<GuessAction> = (view, pick) => {
  const { band, removed, guesses } = view as PlayerView;
  if (guesses.some((g) => g.feedback === 'correct')) return null;
  const tried = new Set([...guesses.map((g) => g.value), ...removed]);
  const width = band.high - band.low;
  // The middle, moved by up to a tenth of the band either way.
  const spread = Math.floor(width / 10);
  const start = band.low + Math.floor(width / 2) - spread + pick(2 * spread + 1);
  for (let k = 0; k <= width; k += 1) {
    const value = band.low + ((start - band.low + k) % (width + 1));
    if (!tried.has(value)) return { value };
  }
  return null;
};
