/**
 * @file   games/seasonal-target/src/geometry.ts
 * @module games/seasonal-target
 * @brief  Cells, areas and the feedback rule of Seasonal Target, exactly in integers.
 *
 * Responsibility: a cell `(x, y)` (1-based, row 1 north), a rectangular area of cells, and
 *                 the answer to a guess: correct, or in `direction` mode the rounded distance
 *                 and one of eight compass sectors, in `distance` mode only the rounded
 *                 distance, in `closeness` mode only the tier (02d §5, O43). The first two also
 *                 carry the tier, which colours the guessed tile (O45), so the client never
 *                 computes it. The rounding (`isqrt`), the sector test and the tier table's
 *                 thresholds are integer comparisons, so no cell is ever decided by a
 *                 floating-point accident (02d §5, §7). Shared by the rules, Leaf Fall's
 *                 candidates (a cell gets the same answer as the secret did, O37) and the
 *                 development bot.
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

// The host's three answer modes, easiest first (O43); `distance` is the default.
export const FEEDBACK_MODES = ['direction', 'distance', 'closeness'] as const;
export type FeedbackMode = (typeof FEEDBACK_MODES)[number];

export const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type Compass = (typeof COMPASS)[number];

export type MissTier = Exclude<Tier, 'correct'>;

export type Feedback =
  | { readonly kind: 'correct' }
  | {
      readonly kind: 'direction';
      readonly distance: number;
      readonly direction: Compass;
      readonly tier: MissTier;
    }
  | { readonly kind: 'distance'; readonly distance: number; readonly tier: MissTier }
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

// The tier table of 02d §7 from far to near: a guess is in a tier when its distance is more
// than `p` % of the grid's diagonal AND more than √m tiles; nearer than every row it is
// burning. The share sets the far tiers on large grids, the minimum the near ones on small
// grids, where a share would ask for less than one tile (O45: 8–30 tiles a side). Both columns
// grow from row to row, so the thresholds stay in order at every size.
const TIER_TABLE: readonly (readonly [MissTier, number, number])[] = [
  ['wayOff', 48, 61],
  ['cold', 32, 40],
  ['cool', 20, 20],
  ['warm', 12, 13],
  ['hot', 6, 8],
];

// The squared diagonal D² = (W − 1)² + (H − 1)²: the farthest two cells can be.
export const diagonal2 = (map: MapSize): number => (map.width - 1) ** 2 + (map.height - 1) ** 2;

// The tier of a guess with squared distance `n` (n > 0) and touching or not. √n / D > p % is
// decided as 10 000 · n > p² · D², √n > √m as n > m, in integers.
export function tierOf(g: Cell, s: Cell, map: MapSize): Tier {
  if (sameCell(g, s)) return 'correct';
  if (Math.max(Math.abs(s.x - g.x), Math.abs(s.y - g.y)) === 1) return 'justMissed';
  const n = squared(g, s);
  const d2 = diagonal2(map);
  for (const [tier, p, m] of TIER_TABLE) if (10_000 * n > p * p * d2 && n > m) return tier;
  return 'burning';
}

// The answer to guess `g` when the target is `s` (02d §5).
export function answerOf(g: Cell, s: Cell, rule: AnswerRule): Feedback {
  if (sameCell(g, s)) return { kind: 'correct' };
  const tier = tierOf(g, s, rule.map) as MissTier;
  if (rule.mode === 'closeness') return { kind: 'closeness', tier };
  const distance = roundedDistance(squared(g, s));
  if (rule.mode === 'distance') return { kind: 'distance', distance, tier };
  return { kind: 'direction', distance, direction: directionOf(g, s), tier };
}

// Whether two answers say the same thing (Leaf Fall's candidate test, O37). The tier counts in
// every mode: it is shown as the tile's colour, and one rounded distance can span two tiers.
export function sameAnswer(a: Feedback, b: Feedback): boolean {
  if (a.kind === 'correct' || b.kind === 'correct') return a.kind === b.kind;
  if (a.kind !== b.kind || a.tier !== b.tier) return false;
  if (a.kind === 'closeness' || b.kind === 'closeness') return true;
  if (a.distance !== b.distance) return false;
  return a.kind !== 'direction' || b.kind !== 'direction' || a.direction === b.direction;
}
