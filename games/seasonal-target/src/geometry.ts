/**
 * @file   games/seasonal-target/src/geometry.ts
 * @module games/seasonal-target
 * @brief  Cells, areas and the feedback rule of Seasonal Target, exactly in integers.
 *
 * Responsibility: a cell `(x, y)` (1-based, row 1 north), a rectangular area of cells, and
 *                 the answer to a guess: correct, or in `direction` mode the rounded distance
 *                 and one of eight compass sectors, in `closeness` mode only the tier (02d §5).
 *                 The rounding (`isqrt`), the sector test and the tier table's thresholds are
 *                 integer comparisons, so no cell is ever decided by a floating-point accident
 *                 (02d §5, §7). Shared by the rules, Leaf Fall's candidates (a cell gets the
 *                 same answer as the secret did, O37) and the development bot.
 * Depends on:     @smg/guess-engine (Tier)
 * Used by:        ./rules, ./leafFall, ./specials, ./views, ./devBot, ./state
 * Spec:           docs/spec/02d-game-seasonal-target.md §4, §5, §7
 */
import type { Tier } from '@smg/guess-engine';

export interface Cell {
  readonly x: number;
  readonly y: number;
}

export interface MapSize {
  readonly width: number;
  readonly height: number;
}

// Inclusive bounds: columns left … right, rows top … bottom.
export interface Area {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export type FeedbackMode = 'direction' | 'closeness';

export const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type Compass = (typeof COMPASS)[number];

export type MissTier = Exclude<Tier, 'correct'>;

export type Feedback =
  | { readonly kind: 'correct' }
  | { readonly kind: 'direction'; readonly distance: number; readonly direction: Compass }
  | { readonly kind: 'closeness'; readonly tier: MissTier };

// What the answer rule needs besides the two cells: the round's mode and map (frozen settings).
export interface AnswerRule {
  readonly mode: FeedbackMode;
  readonly map: MapSize;
}

export const wholeMap = (map: MapSize): Area => ({
  left: 1,
  right: map.width,
  top: 1,
  bottom: map.height,
});

export const inArea = (a: Area, c: Cell): boolean =>
  c.x >= a.left && c.x <= a.right && c.y >= a.top && c.y <= a.bottom;

export const areaWidth = (a: Area): number => a.right - a.left + 1;
export const areaHeight = (a: Area): number => a.bottom - a.top + 1;
export const areaCells = (a: Area): number => areaWidth(a) * areaHeight(a);

export const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;

// A number per cell for sets and sorting: row-major, rows and columns up to 1 000.
export const cellKey = (c: Cell): number => c.y * 1_000 + c.x;

// Every cell of an area, row by row.
export function cellsOf(a: Area): Cell[] {
  const cells: Cell[] = [];
  for (let y = a.top; y <= a.bottom; y += 1) {
    for (let x = a.left; x <= a.right; x += 1) cells.push({ x, y });
  }
  return cells;
}

// The squared distance n = dx² + dy² from the guess to the secret.
export const squared = (g: Cell, s: Cell): number => (s.x - g.x) ** 2 + (s.y - g.y) ** 2;

// The integer square root, corrected for the float's last bit.
export function isqrt(n: number): number {
  let k = Math.floor(Math.sqrt(n));
  while (k * k > n) k -= 1;
  while ((k + 1) * (k + 1) <= n) k += 1;
  return k;
}

// √n rounded to the nearest whole number; never half-way, so there is no tie (02d §5).
export function roundedDistance(n: number): number {
  const k = isqrt(n);
  return n - k * k > k ? k + 1 : k;
}

// The sector from the guess toward the secret: 45° wide, centred on the eight directions.
// (a + b)² < 2b² is the 22.5° boundary off the north–south axis, exactly (02d §5).
export function directionOf(g: Cell, s: Cell): Compass {
  const dx = s.x - g.x;
  // North is positive: row 1 is the north edge.
  const dy = g.y - s.y;
  const a = Math.abs(dx);
  const b = Math.abs(dy);
  const sum = (a + b) ** 2;
  if (sum < 2 * b * b) return dy > 0 ? 'N' : 'S';
  if (sum < 2 * a * a) return dx > 0 ? 'E' : 'W';
  if (dy > 0) return dx > 0 ? 'NE' : 'NW';
  return dx > 0 ? 'SE' : 'SW';
}

// The tier table of 02d §7 in percent of the map's diagonal, from far to near; above `hot` %
// a guess is hot, at or under it burning.
const SHARES: readonly (readonly [MissTier, number])[] = [
  ['wayOff', 40],
  ['cold', 25],
  ['cool', 12],
  ['warm', 6],
  ['hot', 3],
];

// The squared diagonal D² = (W − 1)² + (H − 1)²: the farthest two cells can be.
export const diagonal2 = (map: MapSize): number => (map.width - 1) ** 2 + (map.height - 1) ** 2;

// The tier of a guess with squared distance `n` (n > 0) and touching or not. √n / D > p % is
// decided as 10 000 · n > p² · D², in integers.
export function tierOf(g: Cell, s: Cell, map: MapSize): Tier {
  if (sameCell(g, s)) return 'correct';
  if (Math.max(Math.abs(s.x - g.x), Math.abs(s.y - g.y)) === 1) return 'justMissed';
  const n = squared(g, s);
  const d2 = diagonal2(map);
  for (const [tier, p] of SHARES) if (10_000 * n > p * p * d2) return tier;
  return 'burning';
}

// The answer to guess `g` when the target is `s` (02d §5).
export function answerOf(g: Cell, s: Cell, rule: AnswerRule): Feedback {
  if (sameCell(g, s)) return { kind: 'correct' };
  if (rule.mode === 'closeness') {
    return { kind: 'closeness', tier: tierOf(g, s, rule.map) as MissTier };
  }
  return {
    kind: 'direction',
    distance: roundedDistance(squared(g, s)),
    direction: directionOf(g, s),
  };
}

// Whether two answers say the same thing (Leaf Fall's candidate test, O37).
export function sameAnswer(a: Feedback, b: Feedback): boolean {
  if (a.kind === 'direction' && b.kind === 'direction') {
    return a.distance === b.distance && a.direction === b.direction;
  }
  if (a.kind === 'closeness' && b.kind === 'closeness') return a.tier === b.tier;
  return a.kind === b.kind;
}
