/**
 * @file   games/registry/src/phased.conformance.test.ts
 * @module games/registry
 * @brief  The conformance suite for `phased` game modules: P1, P3–P5 and P7 Delay.
 *
 * Responsibility: run against the phased fixture and every registered phased module (04 §4.8
 *                 rule 9). P1 the same inputs give the same events; P3 every view validates;
 *                 P4 a refused action changes nothing; P5 folding the events gives the live
 *                 state; no outcome row counts a player's actions (T342). P7 (09 §3), metamorphic: at a time `t`, change other players' actions
 *                 received at or after `t − D`; the viewer's player view (their own actions
 *                 kept) and, with anyone's late actions changed, the spectator view stay
 *                 identical at `releasedBefore = t − D`. A variant of the fixture that shows
 *                 one live count must fail P7, so the check is known to bite.
 * Depends on:     vitest, fast-check, @smg/game-sdk, ./index, ./phasedFixture
 * Spec:           docs/spec/09-testing-strategy.md §3 (P7); docs/spec/04-software-architecture.md §4.8
 */
import type { GameEntry } from '@smg/game-sdk';
import { roundRng } from '@smg/game-sdk/crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { GAMES, type InstalledGame } from './index.js';
import { sidesEntry, sidesGame } from './phasedFixture.js';

const PLAYERS = ['p1', 'p2', 'p3'];
const RNG = roundRng(new Uint8Array(32).fill(7));

interface Timed {
  readonly playerId: string;
  readonly receivedAt: number;
  readonly n: number;
}

// Up to 40 actions of three players, 0–3 s apart, from the opening on.
const actions = fc
  .array(
    fc.tuple(fc.integer({ min: 0, max: 2 }), fc.integer(), fc.integer({ min: 0, max: 3_000 })),
    {
      maxLength: 40,
    },
  )
  .map((list) => {
    let at = 0;
    return list.map(([p, n, dt]): Timed => {
      at += dt;
      return { playerId: PLAYERS[p] ?? 'p1', receivedAt: at, n };
    });
  });

// Plays the actions in order; checks P4 at every refusal; returns the events and the state.
function playOut<S, A, E, Cfg, Sec>(entry: GameEntry<S, A, E, Cfg, Sec>, timed: readonly Timed[]) {
  const { module, conformance: kit } = entry;
  const input = kit.input('shared', PLAYERS);
  const { secrets } = kit.sentinels(input);
  let state = module.createRound(input);
  const events: E[] = [];
  let seq = 0;
  for (const t of timed) {
    const action = kit.action(t.n);
    const before = structuredClone(state);
    if (module.validate(state, t.playerId, action) !== null) {
      expect(state).toEqual(before);
      continue;
    }
    seq += 1;
    const act = { playerId: t.playerId, receiveSeq: seq, receivedAt: t.receivedAt, action };
    const decision = module.decide(state, act, {
      now: t.receivedAt,
      cooldownMs: 0,
      secrets,
      rng: RNG,
    });
    if (!decision.ok) {
      expect(state).toEqual(before);
      continue;
    }
    for (const e of decision.events) {
      events.push(e.event);
      state = module.evolve(state, e.event);
    }
  }
  return { state, events, input };
}

// The views at `t` of the actions received before it (what a running round would show).
function viewsAt<S, A, E, Cfg, Sec>(
  entry: GameEntry<S, A, E, Cfg, Sec>,
  timed: readonly Timed[],
  t: number,
  viewer: string,
) {
  const { module } = entry;
  const delay =
    module.phased?.plan(entry.conformance.input('shared', PLAYERS).config).viewDelayMs ?? 0;
  const { state } = playOut(
    entry,
    timed.filter((x) => x.receivedAt < t),
  );
  const ctx = { releasedBefore: t - delay };
  return {
    player: module.views.player(state, viewer, ctx),
    spectator: module.views.spectator(state, ctx),
    delay,
  };
}

// Other players' actions at or after the cut get another value (the viewer's own stay).
const perturbed = (timed: readonly Timed[], cut: number, keep: string | null) =>
  timed.map((x) => (x.receivedAt >= cut && x.playerId !== keep ? { ...x, n: x.n + 1 } : x));

// P7 for one entry: true when every view is unchanged by the late actions of others.
function delayHolds<S, A, E, Cfg, Sec>(entry: GameEntry<S, A, E, Cfg, Sec>) {
  return fc.property(
    actions,
    fc.integer({ min: 0, max: 120_000 }),
    fc.integer({ min: 0, max: 2 }),
    (timed, t, v) => {
      const viewer = PLAYERS[v] ?? 'p1';
      const live = viewsAt(entry, timed, t, viewer);
      const cut = t - live.delay;
      const own = viewsAt(entry, perturbed(timed, cut, viewer), t, viewer);
      const any = viewsAt(entry, perturbed(timed, cut, null), t, viewer);
      expect(own.player).toEqual(live.player);
      expect(any.spectator).toEqual(live.spectator);
    },
  );
}

function phasedConformance<S, A, E, Cfg, Sec>(entry: GameEntry<S, A, E, Cfg, Sec>) {
  const { module } = entry;
  it(`P1, P3–P5 hold for ${module.meta.id}`, () => {
    fc.assert(
      fc.property(actions, (timed) => {
        const live = playOut(entry, timed);
        expect(playOut(entry, timed).events).toEqual(live.events);
        expect(live.events.reduce(module.evolve, module.createRound(live.input))).toEqual(
          live.state,
        );
        const ctx = { releasedBefore: timed.at(-1)?.receivedAt ?? 0 };
        expect(
          module.viewSchemas.spectator.safeParse(module.views.spectator(live.state, ctx)).success,
        ).toBe(true);
        for (const id of PLAYERS) {
          expect(
            module.viewSchemas.player.safeParse(module.views.player(live.state, id, ctx)).success,
          ).toBe(true);
        }
        const result = module.views.result(
          live.state,
          entry.conformance.sentinels(live.input).secrets,
        );
        expect(module.viewSchemas.result.safeParse(result).success).toBe(true);
        // A result row never counts a player's actions: that would show their switches (T342).
        for (const row of module.phased?.outcome(live.state) ?? []) {
          expect(Object.keys(row).sort()).toEqual(['playerId', 'points', 'won']);
        }
      }),
      { numRuns: 100 },
    );
  });
  it(`P7 Delay holds for ${module.meta.id}`, () => {
    fc.assert(delayHolds(entry), { numRuns: 200 });
  });
}

const phasedGames = (games: readonly InstalledGame[]) =>
  games.filter((g) => g.use((e) => e.module.meta.timing === 'phased'));

describe('phased game module conformance (04 §4.8 rule 9)', () => {
  phasedConformance(sidesEntry);
  for (const game of phasedGames(GAMES)) {
    game.use((entry) => {
      phasedConformance(entry);
    });
  }

  it('P7 catches a spectator view that shows one live count', () => {
    // The sabotage: the spectator's counts taken live, from every pick so far.
    const leaky: typeof sidesEntry = {
      ...sidesEntry,
      module: {
        ...sidesGame,
        views: {
          ...sidesGame.views,
          spectator: (s, ctx) => ({
            ...(sidesGame.views.spectator(s, ctx) as object),
            counts: (sidesGame.views.result(s, null) as { counts: unknown }).counts,
          }),
        },
      },
    };
    expect(fc.check(delayHolds(leaky), { numRuns: 200 }).failed).toBe(true);
  });
});
