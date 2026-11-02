/**
 * @file   games/seasonal-target/src/geometry.test.ts
 * @module games/seasonal-target
 * @brief  The feedback rule against float references, the worked examples, the tier table.
 *
 * Responsibility: the integer rounding equals `Math.round(Math.hypot(dx, dy))` for every
 *                 offset up to 99 × 99; the 8-sector test equals an `atan2` reference for every
 *                 (dx, dy) in −99…99; the worked examples of 02d §5; the tier table against a
 *                 float reference for every cell of 8 × 8, 20 × 20, 30 × 30 and 30 × 8 grids
 *                 (both sides of every threshold), every tier reachable at every size 8–30, the
 *                 pinned table of 02d §7 at 8, 20 and 30; touching cells; the answers in all
 *                 three modes, each wrong one with its tier.
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
  FEEDBACK_MODES,
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

  it('answers the worked examples of 02d §5, each wrong answer with its tier', () => {
    const map = { width: 20, height: 20 };
    const rule = { mode: 'direction', map } as const;
    const dist = { mode: 'distance', map } as const;
    const close = { mode: 'closeness', map } as const;
    const cases = [
      [{ x: 4, y: 14 }, { x: 12, y: 10 }, 9, 'NE', 'cold'],
      [{ x: 4, y: 14 }, { x: 17, y: 11 }, 13, 'E', 'wayOff'],
      [{ x: 10, y: 10 }, { x: 12, y: 12 }, 3, 'SE', 'burning'],
      [{ x: 12, y: 11 }, { x: 12, y: 10 }, 1, 'N', 'justMissed'],
      [{ x: 19, y: 2 }, { x: 2, y: 18 }, 23, 'SW', 'wayOff'],
    ] as const;
    for (const [g, s, distance, direction, tier] of cases) {
      expect(answerOf(g, s, rule)).toEqual({ kind: 'direction', distance, direction, tier });
      expect(answerOf(g, s, dist)).toEqual({ kind: 'distance', distance, tier });
      expect(answerOf(g, s, close)).toEqual({ kind: 'closeness', tier });
    }
    expect(squared({ x: 19, y: 2 }, { x: 2, y: 18 })).toBe(545);
  });

  it('answers correct on the cell in every mode', () => {
    const c = { x: 5, y: 5 };
    for (const mode of FEEDBACK_MODES) {
      expect(answerOf(c, c, { mode, map: { width: 20, height: 20 } })).toEqual({ kind: 'correct' });
    }
  });
});

// The float reference of the table: a tier when the distance is more than its share of the
// diagonal and its square more than the minimum `m`.
function referenceTier(dx: number, dy: number, map: MapSize): string {
  if (dx === 0 && dy === 0) return 'correct';
  if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) return 'justMissed';
  const d = Math.hypot(dx, dy);
  const share = (d / Math.hypot(map.width - 1, map.height - 1)) * 100;
  const table = [
    ['wayOff', 48, 61],
    ['cold', 32, 40],
    ['cool', 20, 20],
    ['warm', 12, 13],
    ['hot', 6, 8],
  ] as const;
  return table.find(([, p, m]) => share > p && dx * dx + dy * dy > m)?.[0] ?? 'burning';
}

// The squared distances n of each tier from one corner of a square grid: [smallest, largest].
function tierSpans(side: number): Record<string, readonly [number, number]> {
  const map = { width: side, height: side };
  const spans: Record<string, readonly [number, number]> = {};
  for (const s of cellsOf(wholeMap(map))) {
    const n = squared({ x: 1, y: 1 }, s);
    if (n === 0) continue;
    const tier = tierOf({ x: 1, y: 1 }, s, map);
    const [low, high] = spans[tier] ?? [n, n];
    spans[tier] = [Math.min(low, n), Math.max(high, n)];
  }
  return spans;
}

describe('tier table', () => {
  const maps: MapSize[] = [
    { width: 8, height: 8 },
    { width: 20, height: 20 },
    { width: 30, height: 30 },
    { width: 30, height: 8 },
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
      expect(seen.size).toBe(8);
    });
  }
});

describe('tier table per grid size', () => {
  it('reaches every tier, so every colour step, on every grid size 8–30', () => {
    for (let side = 8; side <= 30; side += 1) {
      expect(Object.keys(tierSpans(side))).toHaveLength(7);
    }
  });

  // The table of 02d §7 per size, in squared tiles n (the distance is √n).
  it('pins the tiers at 8, 20 and 30 tiles a side', () => {
    const near = { justMissed: [1, 2], burning: [4, 8], hot: [9, 13] };
    expect(tierSpans(8)).toEqual({
      ...near,
      warm: [16, 20],
      cool: [25, 40],
      cold: [41, 61],
      wayOff: [65, 98],
    });
    expect(tierSpans(20)).toEqual({
      ...near,
      warm: [16, 26],
      cool: [29, 73],
      cold: [74, 164],
      wayOff: [169, 722],
    });
    expect(tierSpans(30)).toEqual({
      ...near,
      hot: [9, 20],
      warm: [25, 65],
      cool: [68, 170],
      cold: [173, 386],
      wayOff: [388, 1_682],
    });
  });
});

describe('touching', () => {
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
    expect(tierOf({ x: 10, y: 10 }, { x: 12, y: 10 }, { width: 30, height: 30 })).toBe('burning');
  });
});

describe('sameAnswer', () => {
  it('compares answers by what they say, the tier included', () => {
    const d = { kind: 'direction', distance: 3, direction: 'N', tier: 'hot' } as const;
    expect(sameAnswer(d, { ...d })).toBe(true);
    expect(sameAnswer(d, { ...d, distance: 4 })).toBe(false);
    expect(sameAnswer(d, { ...d, direction: 'S' })).toBe(false);
    // One rounded distance can span two tiers; the tile's colour tells them apart.
    expect(sameAnswer(d, { ...d, tier: 'burning' })).toBe(false);
    expect(sameAnswer({ kind: 'closeness', tier: 'hot' }, { kind: 'closeness', tier: 'hot' })).toBe(
      true,
    );
    expect(
      sameAnswer({ kind: 'closeness', tier: 'hot' }, { kind: 'closeness', tier: 'warm' }),
    ).toBe(false);
    expect(sameAnswer({ kind: 'correct' }, { kind: 'correct' })).toBe(true);
    expect(sameAnswer({ kind: 'correct' }, d)).toBe(false);
    const m = { kind: 'distance', distance: 3, tier: 'hot' } as const;
    expect(sameAnswer(m, { ...m })).toBe(true);
    expect(sameAnswer(m, { ...m, distance: 4 })).toBe(false);
    expect(sameAnswer(m, { ...m, tier: 'burning' })).toBe(false);
    // Distance alone never equals an answer that also names a direction.
    expect(sameAnswer(m, d)).toBe(false);
    expect(sameAnswer({ kind: 'closeness', tier: 'hot' }, m)).toBe(false);
  });
});
