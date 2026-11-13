/**
 * @file   games/mind-games/src/fakes.ts
 * @module games/mind-games
 * @brief  Test helpers: a round with given settings, played through validate, decide and evolve.
 *
 * Responsibility: what the game's tests share: a round input from settings, and one step of a
 *                 choice the way the round engine runs it (the game's checks, then its
 *                 decision, folding every event), returning the refusal code or the events.
 * Depends on:     @smg/game-sdk (types), ./module, ./settings, ./state
 * Used by:        the tests of games/mind-games/src
 * Spec:           docs/spec/09-testing-strategy.md §4.2
 */
import type { Emitted } from '@smg/game-sdk';

import { mindGames } from './module.js';
import { DEFAULT_CONFIG, type MindConfig } from './settings.js';
import type { MindChoice, MindEvent, MindState } from './state.js';

export const roundWith = (cfg: Partial<MindConfig> = {}): MindState =>
  mindGames.createRound({
    roundId: 'r1',
    roster: [],
    secretMode: 'shared',
    season: 'winter',
    halving: false,
    config: { ...DEFAULT_CONFIG, ...cfg },
  });

export type Step =
  | { readonly state: MindState; readonly code: string }
  | { readonly state: MindState; readonly events: readonly Emitted<MindEvent>[] };

// One choice of `playerKey` at `at`; a refusal leaves the state as it was.
export function choose(state: MindState, playerKey: string, value: MindChoice, at: number): Step {
  const action = { value };
  const code = mindGames.validate(state, playerKey, action);
  if (code !== null) return { state, code };
  const act = { playerId: playerKey, receiveSeq: 0, receivedAt: at, action };
  const ctx = { now: at, cooldownMs: 0, secrets: null, rng: null as never };
  const decision = mindGames.decide(state, act, ctx);
  if (!decision.ok) return { state, code: decision.code };
  const next = decision.events.reduce((s, e) => mindGames.evolve(s, e.event), state);
  return { state: next, events: decision.events };
}

// Plays a list of [player, choice, hide] at 1 s apart from `start`; refusals are skipped.
export function playAll(
  state: MindState,
  moves: readonly (readonly [string, string, boolean?])[],
  start = 0,
): MindState {
  return moves.reduce(
    (s, [p, choice, hide], i) =>
      choose(s, p, { choice, hide: hide ?? false }, start + i * 1_000).state,
    state,
  );
}
