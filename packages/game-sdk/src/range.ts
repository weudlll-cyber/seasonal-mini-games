/**
 * @file   packages/game-sdk/src/range.ts
 * @module game-sdk
 * @brief  Inclusive integer ranges: size and membership.
 *
 * Responsibility: the range arithmetic number games need (current range, halving windows,
 *                 negative ends included), in one tested place.
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
