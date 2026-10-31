/**
 * @file   games/registry/src/conformance.test.ts
 * @module games/registry
 * @brief  The shared conformance suite, run against every registered game module.
 *
 * Responsibility: for random streams of actions in every secret mode the module supports:
 *                 P1 the same inputs give the same events; P2 no player view, spectator view,
 *                 event or rejection of a running round contains a sentinel secret, while the
 *                 result view does; and nothing about an answer travels without it: a
 *                 `comment` sits only beside a `feedback` (O21), and while Frost holds every
 *                 answer no view shows a `feedback` or a `comment`; P3 every view validates
 *                 against the module's schemas;
 *                 P4 a rejected action changes nothing; P5 folding the emitted events from a
 *                 fresh round gives the live state; P6 every special's effect is the same for
 *                 every player.
 * Depends on:     vitest, fast-check, @smg/game-sdk, ./index
 * Spec:           docs/spec/09-testing-strategy.md §2, §3 (P1–P6); docs/spec/04-software-architecture.md §4.5
 */
import type { Emitted, GameEntry, GameModule, RoundRng, SecretMode } from '@smg/game-sdk';
import { roundRng } from '@smg/game-sdk/crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { GAMES } from './index.js';

const PLAYERS = ['p1', 'p2', 'p3'];
// The secrets are given directly; the round's DRBG still draws what else a game picks.
const RNG: RoundRng = roundRng(new Uint8Array(32).fill(9));
const stream = fc.array(fc.tuple(fc.integer({ min: 0, max: 2 }), fc.integer()), {
  maxLength: 40,
});
type Leaks = (value: unknown) => string[];

// Paths of objects that hold a comment without an answer beside it, or (`held`) any answer.
function answerless(value: unknown, held = false, path = '$'): string[] {
  if (value === null || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  const own =
    (node['comment'] != null && node['feedback'] == null) ||
    (held && (node['comment'] != null || node['feedback'] != null))
      ? [path]
      : [];
  return [...own, ...Object.entries(node).flatMap(([k, v]) => answerless(v, held, `${path}.${k}`))];
}

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
  expect(answerless([spectator, players])).toEqual([]);
  expect(module.viewSchemas.spectator.safeParse(spectator).success).toBe(true);
  for (const v of players) expect(module.viewSchemas.player.safeParse(v).success).toBe(true);
}

// Plays the stream; checks P2, P3 and P4 at every step and the Frost hold at its end;
// returns events and state.
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
    const ctx = { now: act.receivedAt, cooldownMs: 3_000, secrets, rng: RNG };
    const decision =
      code === null ? module.decide(state, act, ctx) : ({ ok: false, code } as const);
    expect(leaks(decision)).toEqual([]);
    expect(answerless(decision)).toEqual([]);
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
  // Frost holding every answer of the stream: the views carry none, and no comment either.
  const held = { releasedBefore: -Infinity };
  const frozen = [
    module.views.spectator(state, held),
    PLAYERS.map((id) => module.views.player(state, id, held)),
  ];
  expect(answerless(frozen, true)).toEqual([]);
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

// P6: a special's effect is the same for every player: in shared mode it goes to the room
// (or the host) only; in individual mode every player gets as many events of their own.
function equalFor(events: readonly Emitted<unknown>[], mode: SecretMode): void {
  const own = PLAYERS.map((id) => events.filter((e) => e.audience === `player:${id}`).length);
  if (mode === 'shared') expect(own.every((n) => n === 0)).toBe(true);
  else expect(new Set(own).size).toBe(1);
}

function specials<S, A, E, Cfg, Sec>(entry: GameEntry<S, A, E, Cfg, Sec>, mode: SecretMode) {
  const { module, conformance: kit } = entry;
  it(`P6 holds for the specials of ${module.meta.id} in ${mode} mode`, () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 32, maxLength: 32 }), (seed) => {
        const input = kit.input(mode, PLAYERS);
        const { secrets } = kit.sentinels(input);
        const state = module.createRound(input);
        const ctx = { now: 0, cooldownMs: 3_000, secrets, rng: roundRng(seed) };
        const hooks = module.specials ?? {};
        equalFor(hooks.springHerald?.(state, ctx) ?? [], mode);
        equalFor(hooks.leafFall?.(state, ctx, { index: 1, count: 5 }) ?? [], mode);
        equalFor(hooks.halving?.(state, ctx, 1) ?? [], mode);
      }),
      { numRuns: 100 },
    );
  });
}

describe('game module conformance', () => {
  for (const entry of GAMES) {
    for (const mode of entry.module.meta.secretModes) {
      conformance(entry, mode);
      specials(entry, mode);
    }
  }
});
