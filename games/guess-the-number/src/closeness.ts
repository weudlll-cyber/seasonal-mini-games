/**
 * @file   games/guess-the-number/src/closeness.ts
 * @module games/guess-the-number
 * @brief  How close a guess came: Guess The Number's place on the engine's tier ladder (O21).
 *
 * Responsibility: the distance relative to the round's range, d = |guess − secret| / (high − low),
 *                 so a tier means the same in a 1–100 and in a −1 000 000–1 000 000 round
 *                 (DECISIONS T70); a hidden range uses its hidden bounds, and a guess outside
 *                 them is the farthest tier. 1 or 2 away is "just missed", whatever the range.
 *                 The ladder itself (tiers, thresholds, trend) is the guess engine's, named
 *                 here as well for the game's tests. Runs on the server only: it needs the secret.
 * Depends on:     @smg/game-sdk (Range), @smg/guess-engine (tiers)
 * Used by:        ./rules, ./settings, ./state
 * Spec:           docs/spec/02-game-guess-the-number.md §6.3; docs/spec/04-software-architecture.md §4.7
 */
import type { Range } from '@smg/game-sdk';
import { tierByPercent, type Thresholds, type Tier } from '@smg/guess-engine';

export { TIERS, trendOf, type Thresholds, type Tier } from '@smg/guess-engine';

export function tierOf(value: number, secret: number, range: Range, t: Thresholds): Tier {
  const gap = Math.abs(value - secret);
  if (gap === 0) return 'correct';
  // Only possible with a hidden range (a shown one refuses such a guess, 02 §5.1).
  if (value < range.low || value > range.high) return 'wayOff';
  if (gap <= 2) return 'justMissed';
  return tierByPercent((gap / (range.high - range.low)) * 100, t);
}
