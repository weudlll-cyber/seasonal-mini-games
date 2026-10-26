/**
 * @file   games/guess-the-number/src/devBot.ts
 * @module games/guess-the-number
 * @brief  The development bot: guesses near the middle of what its own answers leave.
 *
 * Responsibility: from its player view only (never a secret), the window its own answers
 *                 leave inside the range (or inside ±1 000 000 000 when the range is hidden,
 *                 DECISIONS T53), as a player works it out: the server sends no narrowed
 *                 range (O17). It picks a number in that window that it has not guessed and
 *                 that is not removed, near the middle so the search halves, with a little
 *                 spread so bots do not all guess alike. Used by the Quick Test.
 * Depends on:     @smg/game-sdk (DevBot), ./rules, ./views
 * Used by:        ./index, games/registry
 * Spec:           docs/spec/09-testing-strategy.md §5
 */
import type { DevBot } from '@smg/game-sdk';

import { GUESS_LIMIT, type GuessAction } from './rules.js';
import type { PlayerView } from './views.js';

// The numbers the bot's own answered guesses still allow.
function window(view: PlayerView): { low: number; high: number } {
  let low = view.range?.low ?? -GUESS_LIMIT;
  let high = view.range?.high ?? GUESS_LIMIT;
  for (const g of view.guesses) {
    if (g.feedback === 'higher') low = Math.max(low, g.value + 1);
    if (g.feedback === 'lower') high = Math.min(high, g.value - 1);
  }
  return { low, high: Math.max(low, high) };
}

export const gtnDevBot: DevBot<GuessAction> = (view, pick) => {
  const v = view as PlayerView;
  if (v.guesses.some((g) => g.feedback === 'correct')) return null;
  const tried = new Set([...v.guesses.map((g) => g.value), ...v.removed]);
  const { low, high } = window(v);
  const width = high - low;
  // The middle, moved by up to a tenth of the window either way.
  const spread = Math.floor(width / 10);
  const start = low + Math.floor(width / 2) - spread + pick(2 * spread + 1);
  for (let k = 0; k <= Math.min(width, 10_000); k += 1) {
    const value = low + ((start - low + k) % (width + 1));
    if (!tried.has(value)) return { value };
  }
  return null;
};
