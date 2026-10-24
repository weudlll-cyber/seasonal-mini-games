/**
 * @file   packages/game-sdk/src/range.ts
 * @module game-sdk
 * @brief  Inclusive integer ranges: size, membership and intersection.
 *
 * Responsibility: the range arithmetic every number game needs (current range, a player's
 *                 narrowed band, halving windows), in one tested place. An empty
 *                 intersection is null, never a range with low > high.
 * Depends on:     nothing
 * Used by:        ./index, games/*
 * Spec:           docs/spec/09-testing-strategy.md §2 (game-sdk range arithmetic)
 */

export interface Range {
  readonly low: number;
  readonly high: number;
}

export function rangeSize(r: Range): number {
  return r.high - r.low + 1;
}

export function inRange(r: Range, value: number): boolean {
  return Number.isInteger(value) && value >= r.low && value <= r.high;
}

export function intersect(a: Range, b: Range): Range | null {
  const low = Math.max(a.low, b.low);
  const high = Math.min(a.high, b.high);
  return low <= high ? { low, high } : null;
}
