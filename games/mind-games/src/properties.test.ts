/**
 * @file   games/mind-games/src/properties.test.ts
 * @module games/mind-games
 * @brief  MG2, MG3 and MG5 and replay over random rounds of up to 50 players.
 *
 * Responsibility: 09 §4.2's properties at the game's level, over random choices (any of the
 *                 five names or an unknown one, the box ticked or clear, 1–3 000 ms apart) in
 *                 rounds with random switches and All: MG2, every room step's counts equal the
 *                 final choices recomputed from the accepted moves up to it, add up to its
 *                 entrants, and equal what a view cut just after it shows; MG3, every player in
 *                 the round has exactly one first-choice line with their name, a switch has a
 *                 line exactly where it is named; MG5, the points of every row and `won`
 *                 exactly for the scoring players, no row without a choice; P5, folding every
 *                 event gives the live state.
 * Depends on:     vitest, fast-check, ./choices, ./fakes, ./module, ./state, ./views
 * Spec:           docs/spec/09-testing-strategy.md §3 (MG2, MG3, MG5), §4.2
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { CHOICES, countsOf, pointsOf, winnersOf, type Choice } from './choices.js';
import { choose, roundWith } from './fakes.js';
import { mindGames } from './module.js';
import type { ChoiceFed, MindEvent, Move } from './state.js';
import type { ResultView, SpectatorView } from './views.js';

const NAMES = [...CHOICES, 'snow'];

const round = fc.record({
  allOption: fc.boolean(),
  switchVisibility: fc.constantFrom('hidden', 'visible', 'perPlayer' as const),
  winnerPlace: fc.integer({ min: 1, max: 4 }),
});
const moves = fc.array(
  fc.tuple(
    fc.integer({ min: 0, max: 49 }),
    fc.integer({ min: 0, max: NAMES.length - 1 }),
    fc.boolean(),
    fc.integer({ min: 1, max: 3_000 }),
  ),
  { maxLength: 200 },
);

type Cfg = {
  allOption: boolean;
  switchVisibility: 'hidden' | 'visible' | 'perPlayer';
  winnerPlace: number;
};

// Plays the moves; every accepted step's events, with the move it made.
function playOut(cfg: Cfg, list: readonly (readonly [number, number, boolean, number])[]) {
  let state = roundWith(cfg);
  let at = 0;
  const steps: { move: Move; events: readonly MindEvent[] }[] = [];
  for (const [p, n, hide, dt] of list) {
    at += dt;
    const step = choose(state, `p${String(p)}`, { choice: NAMES[n] ?? 'snow', hide }, at);
    if (!('events' in step)) continue;
    state = step.state;
    const move = state.moves.at(-1);
    if (move !== undefined) steps.push({ move, events: step.events.map((e) => e.event) });
  }
  return { state, steps };
}

const fedOf = (events: readonly MindEvent[]) =>
  events.find((e): e is ChoiceFed => e.type === 'ChoiceFed');

describe('Mind Games properties (09 §3, §4.2)', () => {
  it('MG2: every step’s counts are the recomputed final choices and add up to its entrants', () => {
    fc.assert(
      fc.property(round, moves, (cfg, list) => {
        const { state, steps } = playOut(cfg, list);
        const finals = new Map<string, Choice>();
        for (const { move, events } of steps) {
          finals.set(move.playerKey, move.choice);
          const fed = fedOf(events);
          expect(fed?.counts).toEqual(countsOf(finals.values()));
          const total = CHOICES.reduce((sum, c) => sum + (fed?.counts[c] ?? 0), 0);
          expect(total).toBe(fed?.entrants);
          const view = mindGames.views.spectator(state, { releasedBefore: move.at + 1 });
          expect((view as SpectatorView).counts).toEqual(fed?.counts);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('MG3: one named first choice per player, a switch line exactly where it is named', () => {
    fc.assert(
      fc.property(round, moves, (cfg, list) => {
        const { state, steps } = playOut(cfg, list);
        const lines = (mindGames.views.result(state, null) as ResultView).lines;
        const players = new Set(steps.map((s) => s.move.playerKey));
        for (const p of players) {
          expect(lines.filter((l) => l.playerKey === p && l.from === null)).toHaveLength(1);
        }
        for (const { move } of steps.filter((s) => s.move.from !== null)) {
          const named =
            cfg.switchVisibility === 'visible' ||
            (cfg.switchVisibility === 'perPlayer' && !move.hide);
          const line = lines.find((l) => l.at === move.at && l.playerKey === move.playerKey);
          expect(line !== undefined).toBe(named);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('MG5: rows score 1 or 2 exactly for winning final choices; replay equals live', () => {
    fc.assert(
      fc.property(round, moves, (cfg, list) => {
        const { state, steps } = playOut(cfg, list);
        const finals = new Map(steps.map((s) => [s.move.playerKey, s.move.choice]));
        const winners = winnersOf(countsOf(finals.values()), cfg.winnerPlace);
        const rows = mindGames.phased?.outcome(state) ?? [];
        expect(rows.map((r) => r.playerId)).toEqual([...finals.keys()]);
        for (const r of rows) {
          const points = pointsOf(finals.get(r.playerId) ?? 'spring', winners);
          expect([r.points, r.won]).toEqual([points, points > 0]);
        }
        const replay = steps.flatMap((s) => s.events).reduce(mindGames.evolve, roundWith(cfg));
        expect(replay).toEqual(state);
      }),
      { numRuns: 200 },
    );
  });
});
