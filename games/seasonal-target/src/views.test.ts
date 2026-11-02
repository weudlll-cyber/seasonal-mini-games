/**
 * @file   games/seasonal-target/src/views.test.ts
 * @module games/seasonal-target
 * @brief  Views per visibility and mode, Frost, the sentinel check, the closest miss.
 *
 * Responsibility: others' cells from `numbers` on and their answers only under `full` in
 *                 shared mode, none in individual mode; Frost holds answers and comments; the
 *                 spectator sees the shared area and quarter but never an individual one; no
 *                 player or spectator view, room event or rejection of a running round holds a
 *                 target, in both modes, while the result does; every view fits its schema;
 *                 fallen cells outside an area drop out of view; the closest miss by squared
 *                 distance, the earlier on a tie, touching or not, none without another
 *                 player's wrong guess or a winner.
 * Depends on:     vitest, fast-check, ./conformance, ./fakes, ./module, ./views
 * Spec:           docs/spec/02d-game-seasonal-target.md §6, §9, §10; docs/spec/05-security-threat-model.md §3.1
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { stConformance } from './conformance.js';
import { input, Table, targets } from './fakes.js';
import { seasonalTarget } from './module.js';
import { closestMiss, type PlayerView, type SpectatorView } from './views.js';

const ALL = { releasedBefore: Infinity };
const { views, viewSchemas } = seasonalTarget;

function sharedTable(config = {}) {
  const inp = input('shared', ['a', 'b', 'c'], config);
  return new Table(targets(inp, [{ x: 12, y: 10 }]), inp);
}

const playerView = (t: Table, id: string, ctx = ALL) =>
  views.player(t.state, id, ctx) as PlayerView;

describe('visibility', () => {
  it('shows others nothing but the guess under own, the cell under numbers, all under full', () => {
    for (const [visibility, value, answer] of [
      ['own', false, false],
      ['numbers', true, false],
      ['full', true, true],
    ] as const) {
      const t = sharedTable({ feedbackVisibility: visibility });
      t.play('a', { x: 4, y: 14 });
      const seen = playerView(t, 'b').log[0];
      expect(seen?.value !== null).toBe(value);
      expect(seen?.feedback !== null).toBe(answer);
      expect(seen?.comment !== null).toBe(answer);
      // The default answer mode (O43): the rounded distance only, with the tile's tier (O45).
      expect(playerView(t, 'a').guesses[0]?.feedback).toEqual({
        kind: 'distance',
        distance: 9,
        tier: 'cold',
      });
      expect(viewSchemas.player.safeParse(playerView(t, 'b')).success).toBe(true);
    }
  });

  it('shows no other cell in individual mode, to players or spectators', () => {
    const inp = input('individual', ['a', 'b']);
    const t = new Table(
      targets(inp, [
        { x: 3, y: 3 },
        { x: 18, y: 18 },
      ]),
      inp,
    );
    t.play('a', { x: 4, y: 14 });
    expect(playerView(t, 'b').log[0]).toMatchObject({ value: null, feedback: null });
    const spec = views.spectator(t.state, ALL) as SpectatorView;
    expect(spec.log[0]).toMatchObject({ value: null, feedback: null });
  });

  it('holds answers and comments under Frost', () => {
    const t = sharedTable();
    t.play('a', { x: 4, y: 14 }, 5_000);
    const held = { releasedBefore: 5_000 };
    expect(playerView(t, 'a', held).guesses[0]).toMatchObject({ feedback: null, comment: null });
    expect(playerView(t, 'b', held).log[0]).toMatchObject({
      value: { x: 4, y: 14 },
      feedback: null,
      comment: null,
    });
  });
});

describe('areas, quarters and fallen cells', () => {
  it('gives the spectator the shared area and quarter but never an individual one', () => {
    const inp = input('individual', ['a', 'b']);
    const t = new Table(
      targets(inp, [
        { x: 3, y: 3 },
        { x: 18, y: 18 },
      ]),
      inp,
    );
    t.fold(seasonalTarget.specials?.springHerald?.(t.state, t.ctx) ?? []);
    t.fold(seasonalTarget.specials?.halving?.(t.state, t.ctx, 1) ?? []);
    const spec = views.spectator(t.state, ALL) as SpectatorView;
    expect(spec).toMatchObject({ area: null, hint: null, areaSize: { width: 10, height: 20 } });
    expect(playerView(t, 'a').hint?.name).toBe('north-west');
    expect(playerView(t, 'b').hint?.name).toBe('south-east');
    expect(viewSchemas.spectator.safeParse(spec).success).toBe(true);
    // A viewer outside the roster gets the round's area and no hint.
    expect(playerView(t, 'zz')).toMatchObject({ hint: null, area: t.state.area });
  });

  it('drops fallen cells outside the area out of view', () => {
    const t = sharedTable();
    const area = { left: 6, right: 15, top: 1, bottom: 20 };
    t.fold([
      {
        audience: 'room',
        event: {
          type: 'CellsFell',
          index: 1,
          cells: [
            { x: 2, y: 2 },
            { x: 12, y: 2 },
          ],
        },
      },
      {
        audience: 'room',
        event: { type: 'AreaHalved', index: 1, playerId: null, area, width: 10, height: 20 },
      },
    ]);
    expect(playerView(t, 'a').fallen).toEqual([{ x: 12, y: 2 }]);
    expect((views.spectator(t.state, ALL) as SpectatorView).area).toEqual(area);
    expect(t.state.fallen).toHaveLength(2);
  });
});

// The sentinel check (P2) on the game's own kit, with specials folded in as well.
describe('no target reaches a running round', () => {
  for (const mode of ['shared', 'individual'] as const) {
    it(`holds in ${mode} mode`, () => {
      fc.assert(
        fc.property(fc.array(fc.integer(), { maxLength: 30 }), (ns) => {
          const inp = stConformance.input(mode, ['p1', 'p2', 'p3']);
          const { secrets, marks } = stConformance.sentinels(inp);
          const t = new Table(secrets, inp);
          const out: unknown[] = [];
          out.push(t.fold(seasonalTarget.specials?.springHerald?.(t.state, t.ctx) ?? []));
          for (const [k, n] of ns.entries()) {
            out.push(t.play(`p${String(1 + (k % 3))}`, stConformance.action(n).value));
          }
          out.push(t.fold(seasonalTarget.specials?.halving?.(t.state, t.ctx, 1) ?? []));
          out.push(views.spectator(t.state, ALL));
          for (const id of ['p1', 'p2', 'p3']) out.push(views.player(t.state, id, ALL));
          const text = JSON.stringify(out);
          expect(marks.filter((m) => text.includes(m))).toEqual([]);
          const result = JSON.stringify(views.result(t.state, secrets));
          expect(marks.every((m) => result.includes(m))).toBe(true);
          expect(viewSchemas.result.safeParse(views.result(t.state, secrets)).success).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  }
});

describe('closest miss', () => {
  it('is the nearest wrong guess of another player, the earlier on a tie', () => {
    const t = sharedTable();
    t.play('a', { x: 9, y: 10 });
    t.play('b', { x: 15, y: 10 });
    t.play('c', { x: 12, y: 10 });
    expect(closestMiss(t.state, { x: 12, y: 10 })).toEqual({
      playerId: 'a',
      value: { x: 9, y: 10 },
      distance: 3,
      touching: false,
    });
  });

  it('says touching for a neighbour, and is none without a winner or another guess', () => {
    const t = sharedTable();
    t.play('a', { x: 13, y: 11 });
    expect(closestMiss(t.state, { x: 12, y: 10 })).toBeNull();
    t.play('b', { x: 12, y: 10 });
    expect(closestMiss(t.state, { x: 12, y: 10 })).toMatchObject({ touching: true, distance: 1 });
    const alone = sharedTable();
    alone.play('a', { x: 1, y: 1 });
    alone.play('a', { x: 12, y: 10 });
    expect(closestMiss(alone.state, { x: 12, y: 10 })).toBeNull();
  });

  it('is in the shared result only', () => {
    const inp = input('individual', ['a', 'b']);
    const t = new Table(
      targets(inp, [
        { x: 3, y: 3 },
        { x: 18, y: 18 },
      ]),
      inp,
    );
    t.play('a', { x: 3, y: 3 });
    expect(views.result(t.state, t.secrets)).toMatchObject({
      target: null,
      targets: { a: { x: 3, y: 3 }, b: { x: 18, y: 18 } },
      closestMiss: null,
    });
  });
});
