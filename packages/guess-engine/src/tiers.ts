/**
 * @file   packages/guess-engine/src/tiers.ts
 * @module guess-engine
 * @brief  The closeness tiers every guessing game answers with, and the trend between two (O21).
 *
 * Responsibility: the tiers in order from far to found, the percent thresholds that place a
 *                 distance among way off … burning, and the comparison the trend lines use.
 *                 How a guess maps to a tier is each game's own rule (a share of the range,
 *                 of the map's diagonal, a score of pegs); this is only the shared ladder.
 * Depends on:     nothing
 * Used by:        ./comments, ./rules, ./index, games/*
 * Spec:           docs/spec/02-game-guess-the-number.md §6.3; docs/spec/04-software-architecture.md §4.7
 */

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

// Percent of a game's measure: farther than `wayOff` % is way off, and so on down to `hot`;
// at or under `hot` % it is burning.
export interface Thresholds {
  readonly wayOff: number;
  readonly cold: number;
  readonly cool: number;
  readonly warm: number;
  readonly hot: number;
}

export function tierByPercent(percent: number, t: Thresholds): Tier {
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
