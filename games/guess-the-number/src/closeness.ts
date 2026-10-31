/**
 * @file   games/guess-the-number/src/closeness.ts
 * @module games/guess-the-number
 * @brief  How close a guess came: the closeness tier the server computes for every guess (O21).
 *
 * Responsibility: the distance relative to the round's range, d = |guess − secret| / (high − low),
 *                 so a tier means the same in a 1–100 and in a −1 000 000–1 000 000 round
 *                 (DECISIONS T70); a hidden range uses its hidden bounds, and a guess outside
 *                 them is the farthest tier. 1 or 2 away is "just missed", whatever the range.
 *                 The tiers in order from far to found, and the comparison the trend lines
 *                 use. Runs on the server only: it needs the secret.
 * Depends on:     @smg/game-sdk (Range)
 * Used by:        ./comments, ./rules, ./settings, ./state, ./views
 * Spec:           docs/spec/02-game-guess-the-number.md §6.3
 */
import type { Range } from '@smg/game-sdk';

// From far to found; the order is the closeness rank.
export const TIERS = [
  'wayOff',
  'cold',
  'cool',
  'warm',
  'hot',
  'burning',
  'justMissed',
  'correct',
] as const;
export type Tier = (typeof TIERS)[number];

// Percent of the range's width: a guess farther than `wayOff` % is way off, and so on down
// to `hot`; at or under `hot` % (and more than 2 away) it is burning. Admin settings (08 §3).
export interface Thresholds {
  readonly wayOff: number;
  readonly cold: number;
  readonly cool: number;
  readonly warm: number;
  readonly hot: number;
}

export function tierOf(value: number, secret: number, range: Range, t: Thresholds): Tier {
  const gap = Math.abs(value - secret);
  if (gap === 0) return 'correct';
  // Only possible with a hidden range (a shown one refuses such a guess, 02 §5.1).
  if (value < range.low || value > range.high) return 'wayOff';
  if (gap <= 2) return 'justMissed';
  const percent = (gap / (range.high - range.low)) * 100;
  if (percent > t.wayOff) return 'wayOff';
  if (percent > t.cold) return 'cold';
  if (percent > t.cool) return 'cool';
  if (percent > t.warm) return 'warm';
  if (percent > t.hot) return 'hot';
  return 'burning';
}

// "closer" when `now` is a closer tier than `before`, "farther" when a farther one, null when
// they are the same tier: a trend line says nothing the two tiers do not say already (T71).
export function trendOf(before: Tier, now: Tier): 'closer' | 'farther' | null {
  const delta = TIERS.indexOf(now) - TIERS.indexOf(before);
  if (delta === 0) return null;
  return delta > 0 ? 'closer' : 'farther';
}
