/**
 * @file   packages/domain/src/round/fakes.ts
 * @module domain/round
 * @brief  A tiny game module and round builders for the round-engine tests.
 *
 * Responsibility: "pick a number from 1 to 10": one secret per player (or one shared), a
 *                 picked event to the player, Solved on a hit; special hooks that announce
 *                 themselves (Leaf Fall three times, halving twice). 13 is refused by `decide`
 *                 (a game-level late rejection), 20 asks the round to end (RoundShouldEnd),
 *                 values outside 1–20 fail `validate`. Lets the platform rules be tested
 *                 without naming a real game (04 §3).
 * Depends on:     zod, @smg/game-sdk (contract, round settings), ./evolve, ./lifecycle, ./step,
 *                 ./types
 * Used by:        ./*.test.ts
 * Spec:           docs/spec/09-testing-strategy.md §2
 */
import {
  PLATFORM_ROUND_SETTINGS,
  readPlatformRound,
  resolveSettings,
  type GameModule,
  type PlatformRoundConfig,
  type RoundRng,
  type Season,
} from '@smg/game-sdk';
import { z } from 'zod';

import { roundInput, rosterPlayers } from './evolve.js';
import { createRound } from './lifecycle.js';
import { stepRound } from './step.js';
import type { RoundCommand, RoundDeps, RoundEvent, RoundState, StepResult } from './types.js';

export interface Pick {
  readonly value: number;
}
type PickState = Readonly<Record<string, number>>;
type PickEvent =
  | { readonly type: 'picked'; readonly playerId: string }
  | { readonly type: 'special'; readonly name: string; readonly index: number };
type PickSecrets = Readonly<Record<string, number>>;

export const pickGame: GameModule<PickState, Pick, PickEvent, null, PickSecrets> = {
  meta: {
    id: 'pick',
    name: 'Pick',
    contractVersion: 1,
    timing: 'cooldown',
    secretModes: ['shared', 'individual'],
    teams: true,
  },
  settings: { defs: [], read: () => null, problem: () => null },
  actionSchema: z.object({ value: z.number() }),
  deriveSecrets: (input, rng) => {
    const shared = rng.child('secret', 'shared').intBetween(1, 10);
    return Object.fromEntries(
      input.roster.map((p) => [
        p.playerId,
        input.secretMode === 'shared' ? shared : rng.child('secret', p.playerId).intBetween(1, 10),
      ]),
    );
  },
  createRound: (input) => Object.fromEntries(input.roster.map((p) => [p.playerId, 0])),
  validate: (_s, _p, a) =>
    Number.isInteger(a.value) && a.value >= 1 && a.value <= 20 ? null : 'OUT_OF_RANGE',
  decide: (_s, act, ctx) => {
    if (act.action.value === 13) return { ok: false, code: 'UNLUCKY' };
    const event = { type: 'picked', playerId: act.playerId } as const;
    const signals =
      act.action.value === 20
        ? [{ type: 'RoundShouldEnd', reason: 'twenty' } as const]
        : act.action.value === ctx.secrets[act.playerId]
          ? [{ type: 'Solved', playerId: act.playerId } as const]
          : [];
    return {
      ok: true,
      events: [{ audience: `player:${act.playerId}`, feedback: true, event }],
      signals,
    };
  },
  evolve: (s, e) => (e.type === 'special' ? s : { ...s, [e.playerId]: (s[e.playerId] ?? 0) + 1 }),
  // Each special announces itself to the room; Leaf Fall runs three times, halving twice.
  specials: {
    springHerald: () => [
      { audience: 'room', event: { type: 'special', name: 'spring', index: 0 } },
    ],
    leafFall: (_s, _c, fall) =>
      fall.index > 3
        ? []
        : [{ audience: 'room', event: { type: 'special', name: 'leaf', index: fall.index } }],
    halving: (_s, _c, index) =>
      index > 2 ? [] : [{ audience: 'room', event: { type: 'special', name: 'halving', index } }],
  },
  views: { player: (s, id) => s[id], spectator: (s) => s, result: (_s, sec) => sec },
  viewSchemas: {
    player: z.number(),
    spectator: z.record(z.string(), z.number()),
    result: z.unknown(),
  },
};

// A RoundRng whose every child returns the same fixed value: secrets are `secret`.
export function fixedRng(secret: number): RoundRng {
  return {
    child: () => ({ nextUint32: () => 0, nextInt: () => 0, intBetween: () => secret }),
  };
}

export type PickRound = RoundState<PickState, null>;
export type PickEvents = RoundEvent<PickEvent, Pick, null>[];

export function config(change: Partial<PlatformRoundConfig> = {}): PlatformRoundConfig {
  return { ...readPlatformRound(resolveSettings(PLATFORM_ROUND_SETTINGS, {})), ...change };
}

// Drives a round of the pick game, keeping the whole log, as the round actor will.
export class PickDriver {
  state: PickRound;
  readonly log: PickEvents;
  private readonly deps: { secrets: PickSecrets | null };

  constructor(
    change: Partial<PlatformRoundConfig> = {},
    private readonly rng: RoundRng = fixedRng(7),
    season: Season = 'spring',
  ) {
    const created = createRound<PickState, Pick, PickEvent, null>({
      roundId: 'r1',
      // Specials only where a test asks for them.
      config: config({ specialOn: false, ...change }),
      gameConfig: null,
      season,
      commitment: 'c0ffee',
    });
    this.state = created.state;
    this.log = [created.event];
    this.deps = { secrets: null };
  }

  run(cmd: RoundCommand<Pick>): StepResult<PickState, Pick, PickEvent, null> {
    const deps: RoundDeps<PickState, Pick, PickEvent, null, PickSecrets> = {
      module: pickGame,
      secrets: this.deps.secrets,
      rng: this.rng,
      seed: '5eed',
    };
    const result = stepRound(this.state, cmd, deps);
    this.state = result.state;
    this.log.push(...result.events);
    if (this.deps.secrets === null && this.state.game !== null) {
      const input = roundInput(this.state, rosterPlayers(this.state));
      this.deps.secrets = pickGame.deriveSecrets(input, this.rng);
    }
    return result;
  }

  get secrets(): PickSecrets | null {
    return this.deps.secrets;
  }

  // Countdown at 0 with the given players, so the round opens at the countdown's end.
  start(players: readonly string[], teams: readonly (string | null)[] = []): number {
    const roster = players.map((playerId, i) => ({ playerId, team: teams[i] ?? null }));
    this.run({ type: 'startCountdown', at: 0, roster, minPlayers: 1 });
    return this.state.opensAt ?? 0;
  }

  guess(playerId: string, value: number, receivedAt: number) {
    return this.run({ type: 'guess', playerId, receivedAt, action: { value } }).reply;
  }
}
