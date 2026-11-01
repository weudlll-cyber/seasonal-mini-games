/**
 * @file   games/seasonal-target/src/leafFall.test.ts
 * @module games/seasonal-target
 * @brief  Leaf Fall's candidate cells (O37) as properties, in every mode and visibility.
 *
 * Responsibility: with a shared target and `full`, every fallen cell gets from every delivered
 *                 public guess the same answer as the target did (distance and direction, or
 *                 the tier), and an answer Frost holds does not cut the set; otherwise the
 *                 candidates are exactly the cells in the area(s), not fallen, not guessed, no
 *                 secret; no fall hits a guess or a secret; falls stop exactly at
 *                 `autumn.minCellsLeft`; a halving first keeps the candidates in its window;
 *                 the same seed and guesses give the same cells.
 * Depends on:     vitest, fast-check, @smg/game-sdk, @smg/guess-engine, ./fakes, ./geometry,
 *                 ./leafFall, ./module, ./secrets
 * Spec:           docs/spec/02d-game-seasonal-target.md §8.3; docs/spec/09-testing-strategy.md §4.1
 */
import { roundRng } from '@smg/game-sdk/crypto';
import { allSecrets, secretOf } from '@smg/guess-engine';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { input, Table } from './fakes.js';
import { answerOf, cellKey, cellsOf, inArea, sameAnswer, wholeMap, type Cell } from './geometry.js';
import { candidatesOf } from './leafFall.js';
import { seasonalTarget } from './module.js';
import { cellOf } from './secrets.js';

const PLAYERS = ['a', 'b', 'c'];
const cell = fc.record({ x: fc.integer({ min: 1, max: 20 }), y: fc.integer({ min: 1, max: 20 }) });
const round = fc.record({
  seed: fc.uint8Array({ minLength: 32, maxLength: 32 }),
  guesses: fc.array(cell, { maxLength: 12 }),
  // Guesses received at or after this time are still held by Frost.
  cut: fc.integer({ min: 0, max: 12_000 }),
  feedback: fc.constantFrom('direction' as const, 'closeness' as const),
});
type Round = typeof round extends fc.Arbitrary<infer T> ? T : never;

function play(r: Round, mode: 'shared' | 'individual', visibility: 'own' | 'numbers' | 'full') {
  const inp = input(mode, PLAYERS, {
    width: 20,
    height: 20,
    feedback: r.feedback,
    feedbackVisibility: visibility,
  });
  const t = new Table(seasonalTarget.deriveSecrets(inp, roundRng(r.seed)), inp);
  for (const [k, g] of r.guesses.entries()) t.play(PLAYERS[k % 3] ?? 'a', g, k * 1_000);
  return t;
}

const fall = (t: Table, index: number, count: number, releasedBefore: number) =>
  t.fold(
    seasonalTarget.specials?.leafFall?.(t.state, t.ctx, { index, count, releasedBefore }) ?? [],
  );

const fallen = (events: readonly { event: unknown }[]): Cell[] =>
  events.flatMap((e) => (e.event as { cells: Cell[] }).cells);

describe('Leaf Fall with a shared target and full', () => {
  it('drops only cells that answer every delivered public guess as the target did', () => {
    fc.assert(
      fc.property(round, (r) => {
        const t = play(r, 'shared', 'full');
        const target = cellOf(secretOf(t.secrets, ''));
        const rule = { mode: r.feedback, map: t.state.map };
        const delivered = Object.values(t.state.players)
          .flatMap((p) => p.guesses)
          .filter((g) => g.receivedAt < r.cut);
        const guessed = new Set(r.guesses.map(cellKey));
        const cells = fallen(fall(t, 1, 30, r.cut));
        for (const c of [target, ...cells]) {
          for (const g of delivered) {
            expect(sameAnswer(answerOf(g.value, c, rule), g.feedback)).toBe(true);
          }
        }
        for (const c of cells) {
          expect(guessed.has(cellKey(c))).toBe(false);
          expect(cellKey(c)).not.toBe(cellKey(target));
        }
      }),
      { numRuns: 200 },
    );
  });

  it('does not let an answer Frost holds cut the set', () => {
    const inp = input('shared', PLAYERS, { width: 20, height: 20 });
    const t = new Table(
      {
        mode: 'shared',
        value: { x: 10, y: 10, rule: { mode: 'direction', map: { width: 20, height: 20 } } },
      },
      inp,
    );
    t.play('a', { x: 1, y: 1 }, 5_000);
    // Held: every cell but the guess and the target.
    expect(candidatesOf(t.state, t.secrets, 5_000)).toHaveLength(398);
    // Delivered: only cells 13 away to the south-east of the guess are left.
    expect(candidatesOf(t.state, t.secrets, 5_001).length).toBeLessThan(40);
  });
});

describe('Leaf Fall where no answer is public', () => {
  const cases = [
    ['shared', 'own'],
    ['shared', 'numbers'],
    ['individual', 'full'],
  ] as const;
  for (const [mode, visibility] of cases) {
    it(`uses no answer: ${mode} mode, ${visibility}`, () => {
      fc.assert(
        fc.property(round, (r) => {
          const t = play(r, mode, visibility);
          const out = new Set([...r.guesses, ...allSecrets(t.secrets).map(cellOf)].map(cellKey));
          const expected = cellsOf(wholeMap(t.state.map)).filter((c) => !out.has(cellKey(c)));
          expect(candidatesOf(t.state, t.secrets, Infinity)).toEqual(expected);
          const cells = fallen(fall(t, 1, 10, Infinity));
          expect(cells.every((c) => !out.has(cellKey(c)))).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  }
});

describe('Leaf Fall stops and repeats', () => {
  it('stops exactly at autumn.minCellsLeft, the last fall taking only what that allows', () => {
    const inp = input('shared', PLAYERS, {
      width: 20,
      height: 20,
      feedbackVisibility: 'own',
      autumnMinCellsLeft: 25,
    });
    const t = new Table(seasonalTarget.deriveSecrets(inp, roundRng(new Uint8Array(32))), inp);
    let index = 0;
    for (;;) {
      index += 1;
      const events = fall(t, index, 40, Infinity);
      if (events.length === 0) break;
    }
    // 400 cells, 1 secret: 399 candidates, ten falls of 40 would leave −1; the last takes 14.
    expect(t.state.fallen).toHaveLength(399 - 25);
    expect(candidatesOf(t.state, t.secrets, Infinity)).toHaveLength(25);
    // A fallen cell is no candidate any more and stays out of every fall.
    expect(new Set(t.state.fallen.map(cellKey)).size).toBe(t.state.fallen.length);
  });

  it('gives the same cells for the same seed and guesses', () => {
    fc.assert(
      fc.property(round, (r) => {
        expect(fallen(fall(play(r, 'shared', 'full'), 1, 10, r.cut))).toEqual(
          fallen(fall(play(r, 'shared', 'full'), 1, 10, r.cut)),
        );
      }),
      { numRuns: 100 },
    );
  });

  it('counts candidates only inside the window after a halving at the same instant', () => {
    fc.assert(
      fc.property(round, fc.constantFrom('shared' as const, 'individual' as const), (r, mode) => {
        const t = play(r, mode, 'own');
        t.fold(seasonalTarget.specials?.halving?.(t.state, t.ctx, 1) ?? []);
        const areas = Object.values(t.state.players).map((p) => p.area);
        const cells = fallen(fall(t, 1, 50, Infinity));
        expect(cells.every((c) => areas.some((a) => inArea(a, c)))).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
