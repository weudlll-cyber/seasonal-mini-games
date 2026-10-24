/**
 * @file   games/registry/src/conformance.test.ts
 * @module games/registry
 * @brief  The shared conformance suite, run against every registered game module.
 *
 * Responsibility: for random streams of actions in every secret mode the module supports:
 *                 P1 the same inputs give the same events; P2 no player view, spectator view,
 *                 event or rejection of a running round contains a sentinel secret, while the
 *                 result view does; P3 every view validates against the module's schemas;
 *                 P4 a rejected action changes nothing; P5 folding the emitted events from a
 *                 fresh round gives the live state. P6 (specials) joins with the specials.
 * Depends on:     vitest, fast-check, @smg/game-sdk, ./index
 * Spec:           docs/spec/09-testing-strategy.md §2, §3 (P1–P5); docs/spec/04-software-architecture.md §4.5
 */
import type { GameEntry, GameModule, RoundRng, SecretMode } from '@smg/game-sdk';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { GAMES } from './index.js';

const PLAYERS = ['p1', 'p2', 'p3'];
const noRng: RoundRng = {
  child: () => {
    throw new Error('the suite gives the secrets directly');
  },
};
const stream = fc.array(fc.tuple(fc.integer({ min: 0, max: 2 }), fc.integer()), {
  maxLength: 40,
});
type Leaks = (value: unknown) => string[];

// P2 and P3 for every view of a running round.
function checkViews<S, A, E, Cfg, Sec>(
  module: GameModule<S, A, E, Cfg, Sec>,
  state: S,
  leaks: Leaks,
) {
  const ctx = { releasedBefore: Infinity };
  const spectator = module.views.spectator(state, ctx);
  const players = PLAYERS.map((id) => module.views.player(state, id, ctx));
  expect(leaks([spectator, players])).toEqual([]);
  expect(module.viewSchemas.spectator.safeParse(spectator).success).toBe(true);
  for (const v of players) expect(module.viewSchemas.player.safeParse(v).success).toBe(true);
}

// Plays the stream; checks P2, P3 and P4 at every step; returns events and state.
function play<S, A, E, Cfg, Sec>(
  entry: GameEntry<S, A, E, Cfg, Sec>,
  mode: SecretMode,
  actions: readonly (readonly [number, number])[],
  leaks: Leaks,
) {
  const { module, conformance: kit } = entry;
  const input = kit.input(mode, PLAYERS);
  const { secrets } = kit.sentinels(input);
  let state = module.createRound(input);
  const events: E[] = [];
  for (const [k, [p, n]] of actions.entries()) {
    const action = kit.action(n);
    const act = { playerId: PLAYERS[p] ?? 'p1', receiveSeq: k + 1, receivedAt: k * 1_000, action };
    const before = structuredClone(state);
    const code = module.validate(state, act.playerId, action);
    const ctx = { now: act.receivedAt, cooldownMs: 3_000, secrets, rng: noRng };
    const decision =
      code === null ? module.decide(state, act, ctx) : ({ ok: false, code } as const);
    expect(leaks(decision)).toEqual([]);
    if (!decision.ok) {
      expect(state).toEqual(before);
      continue;
    }
    for (const e of decision.events) {
      events.push(e.event);
      state = module.evolve(state, e.event);
    }
    checkViews(module, state, leaks);
  }
  return { state, events };
}

function conformance<S, A, E, Cfg, Sec>(entry: GameEntry<S, A, E, Cfg, Sec>, mode: SecretMode) {
  const { module, conformance: kit } = entry;
  const input = kit.input(mode, PLAYERS);
  const { secrets, marks } = kit.sentinels(input);
  const leaks: Leaks = (value) => {
    const text = JSON.stringify(value);
    return marks.filter((m) => text.includes(m));
  };

  it(`P1–P5 hold for ${module.meta.id} in ${mode} mode`, () => {
    fc.assert(
      fc.property(stream, (actions) => {
        const live = play(entry, mode, actions, leaks);
        expect(play(entry, mode, actions, leaks).events).toEqual(live.events);
        expect(live.events.reduce(module.evolve, module.createRound(input))).toEqual(live.state);
        const result = module.views.result(live.state, secrets);
        expect(module.viewSchemas.result.safeParse(result).success).toBe(true);
        expect(leaks(result)).toEqual([...marks]);
      }),
      { numRuns: 100 },
    );
  });
}

describe('game module conformance', () => {
  for (const entry of GAMES) {
    for (const mode of entry.module.meta.secretModes) conformance(entry, mode);
  }
});
