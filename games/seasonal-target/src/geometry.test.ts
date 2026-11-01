/**
 * @file   games/seasonal-target/src/geometry.test.ts
 * @module games/seasonal-target
 * @brief  The feedback rule against float references, the worked examples, the tier table.
 *
 * Responsibility: the integer rounding equals `Math.round(Math.hypot(dx, dy))` for every
 *                 offset up to 99 × 99; the 8-sector test equals an `atan2` reference for every
 *                 (dx, dy) in −99…99; the worked examples of 02d §5; the tier table against a
 *                 float reference for every cell of 20 × 20, 50 × 50 and 100 × 20 maps (both
 *                 sides of every threshold), touching cells; the answers in both modes.
 * Depends on:     vitest, fast-check, ./geometry
 * Spec:           docs/spec/09-testing-strategy.md §4.1; docs/spec/02d-game-seasonal-target.md §5, §7
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  answerOf,
  cellsOf,
  COMPASS,
  directionOf,
  isqrt,
  roundedDistance,
  sameAnswer,
  squared,
  tierOf,
  wholeMap,
  type MapSize,
} from './geometry.js';

describe('distance and direction', () => {
  it('rounds √n like Math.round(Math.hypot) for every offset up to 99 × 99', () => {
    for (let dx = 0; dx <= 99; dx += 1) {
      for (let dy = 0; dy <= 99; dy += 1) {
        expect(roundedDistance(dx * dx + dy * dy)).toBe(Math.round(Math.hypot(dx, dy)));
      }
    }
  });

  it('takes exact integer square roots', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000_000 }), (n) => {
        const k = isqrt(n);
        expect(k * k <= n && (k + 1) * (k + 1) > n).toBe(true);
      }),
      { numRuns: 1_000 },
    );
  });

  it('names the same sector as an atan2 reference for every offset in −99…99', () => {
    const g = { x: 100, y: 100 };
    for (let dx = -99; dx <= 99; dx += 1) {
      for (let dy = -99; dy <= 99; dy += 1) {
        if (dx === 0 && dy === 0) continue;
        // Degrees clockwise from north; sector k is centred on k · 45°.
        const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
        const k = Math.round(((deg + 360) % 360) / 45) % 8;
        // The secret lies dx east and dy north of the guess (row 1 is north).
        expect(directionOf(g, { x: g.x + dx, y: g.y - dy })).toBe(COMPASS[k]);
      }
    }
  });

  it('answers the worked examples of 02d §5', () => {
    const rule = { mode: 'direction', map: { width: 50, height: 50 } } as const;
    const close = { mode: 'closeness', map: { width: 50, height: 50 } } as const;
    const cases = [
      [{ x: 12, y: 34 }, { x: 20, y: 30 }, 9, 'NE', 'cool'],
      [{ x: 12, y: 34 }, { x: 25, y: 31 }, 13, 'E', 'cool'],
      [{ x: 20, y: 31 }, { x: 20, y: 30 }, 1, 'N', 'justMissed'],
      [{ x: 49, y: 2 }, { x: 3, y: 47 }, 64, 'SW', 'wayOff'],
    ] as const;
    for (const [g, s, distance, direction, tier] of cases) {
      expect(answerOf(g, s, rule)).toEqual({ kind: 'direction', distance, direction });
      expect(answerOf(g, s, close)).toEqual({ kind: 'closeness', tier });
    }
    expect(squared({ x: 49, y: 2 }, { x: 3, y: 47 })).toBe(4_141);
  });

  it('answers correct on the cell in both modes', () => {
    const c = { x: 5, y: 5 };
    expect(answerOf(c, c, { mode: 'direction', map: { width: 20, height: 20 } })).toEqual({
      kind: 'correct',
    });
    expect(answerOf(c, c, { mode: 'closeness', map: { width: 20, height: 20 } })).toEqual({
      kind: 'correct',
    });
  });
});

// The float reference of the table: share of the diagonal in percent.
function referenceTier(dx: number, dy: number, map: MapSize): string {
  if (dx === 0 && dy === 0) return 'correct';
  if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) return 'justMissed';
  const share = (Math.hypot(dx, dy) / Math.hypot(map.width - 1, map.height - 1)) * 100;
  const table = [
    ['wayOff', 40],
    ['cold', 25],
    ['cool', 12],
    ['warm', 6],
    ['hot', 3],
  ] as const;
  return table.find(([, p]) => share > p)?.[0] ?? 'burning';
}

describe('tier table', () => {
  const maps: MapSize[] = [
    { width: 20, height: 20 },
    { width: 50, height: 50 },
    { width: 100, height: 20 },
  ];
  for (const map of maps) {
    it(`matches the float reference for every cell of ${String(map.width)} × ${String(map.height)}`, () => {
      const seen = new Set<string>();
      // From a corner every share from 0 to 100 % occurs, so every threshold is crossed.
      const from = { x: 1, y: 1 };
      for (const s of cellsOf(wholeMap(map))) {
        const tier = tierOf(from, s, map);
        expect(tier).toBe(referenceTier(s.x - 1, s.y - 1, map));
        seen.add(tier);
      }
      // On a 20 × 20 map two cells apart are already 7 % of the diagonal: no hot, no burning.
      expect(seen.size).toBe(map.width === 20 && map.height === 20 ? 6 : 8);
    });
  }

  it('counts touching cells, diagonals included, as just missed', () => {
    const map = { width: 20, height: 20 };
    for (const [dx, dy] of [
      [1, 0],
      [1, 1],
      [0, -1],
      [-1, 1],
    ] as const) {
      expect(tierOf({ x: 10, y: 10 }, { x: 10 + dx, y: 10 + dy }, map)).toBe('justMissed');
    }
    // Two away is no longer touching, though close.
    expect(tierOf({ x: 10, y: 10 }, { x: 12, y: 10 }, { width: 50, height: 50 })).toBe('burning');
  });
});

describe('sameAnswer', () => {
  it('compares answers by what they say', () => {
    const d = { kind: 'direction', distance: 3, direction: 'N' } as const;
    expect(sameAnswer(d, { ...d })).toBe(true);
    expect(sameAnswer(d, { ...d, distance: 4 })).toBe(false);
    expect(sameAnswer(d, { ...d, direction: 'S' })).toBe(false);
    expect(sameAnswer({ kind: 'closeness', tier: 'hot' }, { kind: 'closeness', tier: 'hot' })).toBe(
      true,
    );
    expect(
      sameAnswer({ kind: 'closeness', tier: 'hot' }, { kind: 'closeness', tier: 'warm' }),
    ).toBe(false);
    expect(sameAnswer({ kind: 'correct' }, { kind: 'correct' })).toBe(true);
    expect(sameAnswer({ kind: 'correct' }, d)).toBe(false);
  });
});
