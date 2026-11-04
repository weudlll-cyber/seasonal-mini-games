/**
 * @file   games/seasonal-target/src/specials.test.ts
 * @module games/seasonal-target
 * @brief  Halving's windows (Spring Herald's quarters are ./spring.test).
 *
 * Responsibility: halving as a property: every
 *                 window holds its secret, lies inside the previous one, has the longer side
 *                 halved rounded up (the width on a tie), the same size for every player, and
 *                 stops once the area ≤ `halving.minCells`; positions uniform among the legal
 *                 ones (chi-square smoke); the same seed gives the same windows.
 * Depends on:     vitest, fast-check, @smg/game-sdk, @smg/guess-engine, ./fakes, ./geometry,
 *                 ./module, ./specials, ./state
 * Spec:           docs/spec/02d-game-seasonal-target.md §8.4; docs/spec/09-testing-strategy.md §4.1
 */
import { roundRng } from '@smg/game-sdk/crypto';
import { secretOf } from '@smg/guess-engine';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { input, Table } from './fakes.js';
import { areaCells, areaHeight, areaWidth, inArea, type Area } from './geometry.js';
import { seasonalTarget } from './module.js';
import { halvedSize, windowIn } from './specials.js';
import type { StState } from './state.js';

const hooks = seasonalTarget.specials;
const PLAYERS = ['a', 'b', 'c'];

const round = fc.record({
  mode: fc.constantFrom('shared' as const, 'individual' as const),
  seed: fc.uint8Array({ minLength: 32, maxLength: 32 }),
  width: fc.integer({ min: 8, max: 30 }),
  height: fc.integer({ min: 8, max: 30 }),
  minCells: fc.integer({ min: 4, max: 32 }),
});

// Every halving until the special has run its course; the areas of each player per step.
function halveAll(r: typeof round extends fc.Arbitrary<infer T> ? T : never) {
  const inp = input(r.mode, PLAYERS, {
    width: r.width,
    height: r.height,
    halvingMinCells: r.minCells,
  });
  const secrets = seasonalTarget.deriveSecrets(inp, roundRng(r.seed));
  let state: StState = seasonalTarget.createRound(inp);
  const ctx = { now: 0, cooldownMs: 3_000, secrets, rng: roundRng(r.seed) };
  const steps: Area[][] = [PLAYERS.map((id) => state.players[id]?.area as Area)];
  for (let k = 1; k < 40; k += 1) {
    const events = hooks?.halving?.(state, ctx, k) ?? [];
    if (events.length === 0) break;
    for (const e of events) state = seasonalTarget.evolve(state, e.event);
    steps.push(PLAYERS.map((id) => state.players[id]?.area as Area));
  }
  return { state, secrets, steps };
}

describe('halving', () => {
  it('keeps every secret inside a halved window of the same size, until minCells', () => {
    fc.assert(
      fc.property(round, (r) => {
        const { state, secrets, steps } = halveAll(r);
        for (const [k, areas] of steps.entries()) {
          for (const [i, a] of areas.entries()) {
            expect(inArea(a, secretOf(secrets, PLAYERS[i] ?? ''))).toBe(true);
            const before = steps[k - 1]?.[i];
            if (before === undefined) continue;
            expect(a.left >= before.left && a.right <= before.right).toBe(true);
            expect(a.top >= before.top && a.bottom <= before.bottom).toBe(true);
            const size = halvedSize(areaWidth(before), areaHeight(before));
            expect([areaWidth(a), areaHeight(a)]).toEqual([size.width, size.height]);
            expect(areaCells(before)).toBeGreaterThan(r.minCells);
          }
          expect(new Set(areas.map(areaCells)).size).toBe(1);
        }
        const last = steps.at(-1)?.[0] as Area;
        expect(areaCells(last)).toBeLessThanOrEqual(r.minCells);
        expect(state.areaSize).toEqual({ width: areaWidth(last), height: areaHeight(last) });
        // The same seed halves the same way.
        expect(halveAll(r).steps).toEqual(steps);
      }),
      { numRuns: 100 },
    );
  });

  it('halves the width on a tie and the longer side otherwise', () => {
    expect(halvedSize(50, 50)).toEqual({ width: 25, height: 50 });
    expect(halvedSize(25, 50)).toEqual({ width: 25, height: 25 });
    expect(halvedSize(25, 25)).toEqual({ width: 13, height: 25 });
  });
});

describe('halving positions', () => {
  it('places the window uniformly among the legal positions (chi-square smoke)', () => {
    // A 20-wide area with the secret in column 10: halving to 10 columns leaves 10 starts.
    const area = { left: 1, right: 20, top: 1, bottom: 10 };
    const counts = new Array<number>(10).fill(0);
    const draws = 5_000;
    const root = roundRng(new Uint8Array(32).fill(1));
    for (let i = 0; i < draws; i += 1) {
      const rng = root.child('halving', String(i), 'shared');
      const w = windowIn(area, { x: 10, y: 5 }, rng);
      counts[w.left - 1] = (counts[w.left - 1] ?? 0) + 1;
    }
    const expected = draws / 10;
    const chi = counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
    // 9 degrees of freedom: p = 0.001 at 27.88.
    expect(chi).toBeLessThan(27.88);
  });

  it('tells the room only the size in individual mode', () => {
    const inp = input('individual', PLAYERS);
    const t = new Table(seasonalTarget.deriveSecrets(inp, roundRng(new Uint8Array(32))), inp);
    const events = t.fold(hooks?.halving?.(t.state, t.ctx, 1) ?? []);
    expect(events.at(-1)).toEqual({
      audience: 'room',
      event: { type: 'AreaHalved', index: 1, playerId: null, area: null, width: 10, height: 20 },
    });
    expect(events.slice(0, 3).map((e) => e.audience)).toEqual(['player:a', 'player:b', 'player:c']);
  });
});
