/**
 * @file   packages/application/src/round/fakes.ts
 * @module application/round
 * @brief  A minimal game module for the round-session tests ("find the number 1–10").
 *
 * Responsibility: secrets drawn from the round randomness (so the fairness proof can be
 *                 checked), one own setting the host chooses (`find.max`, with a cross-key
 *                 rule), Solved on a hit. Lets the application layer be tested without
 *                 naming a real game (04 §3).
 * Depends on:     zod, @smg/game-sdk (contract)
 * Used by:        ./*.test.ts
 * Spec:           docs/spec/09-testing-strategy.md §2
 */
import type { GameModule } from '@smg/game-sdk';
import { z } from 'zod';

type FindSecrets = Readonly<Record<string, number>>;

export const findGame: GameModule<
  number,
  { value: number },
  { hit: boolean },
  { max: number },
  FindSecrets
> = {
  meta: {
    id: 'find',
    name: 'Find',
    contractVersion: 1,
    timing: 'cooldown',
    secretModes: ['shared'],
    teams: false,
  },
  settings: {
    defs: [
      {
        key: 'find.max',
        kind: 'int',
        label: 'Highest number',
        help: 'The secret is at most this.',
        default: 10,
        min: 2,
        max: 100,
        unit: '',
        status: 'technical',
        editPermission: 'settings.game.edit',
        hostChooses: true,
        running: 'frozen',
        spec: 'test',
      },
    ],
    read: (values) => ({ max: values['find.max'] as number }),
    problem: (cfg) => (cfg.max === 13 ? 'Thirteen is unlucky.' : null),
  },
  actionSchema: z.object({ value: z.number() }),
  deriveSecrets: (input, rng) =>
    Object.fromEntries(
      input.roster.map((p) => [
        p.playerId,
        rng.child('secret', 'shared').intBetween(1, input.config.max),
      ]),
    ),
  createRound: () => 0,
  validate: () => null,
  decide: (_s, act, ctx) => {
    const hit = act.action.value === ctx.secrets[act.playerId];
    return {
      ok: true,
      events: [{ audience: `player:${act.playerId}`, event: { hit } }],
      signals: hit ? [{ type: 'Solved', playerId: act.playerId }] : [],
    };
  },
  evolve: (s) => s + 1,
  views: { player: (s) => s, spectator: (s) => s, result: (_s, secrets) => secrets },
  viewSchemas: { player: z.number(), spectator: z.number(), result: z.unknown() },
};

// A phased game without a secret (04 §4.8): each player picks a side, the result counts them.
export const pickGame: GameModule<
  Readonly<Record<string, string>>,
  { value: string },
  { player: string; side: string },
  null,
  null
> = {
  meta: {
    id: 'pick',
    name: 'Pick',
    contractVersion: 1,
    timing: 'phased',
    secretModes: [],
    teams: false,
  },
  settings: { defs: [], read: () => null, problem: () => null },
  actionSchema: z.object({ value: z.string() }),
  deriveSecrets: () => null,
  createRound: () => ({}),
  validate: () => null,
  decide: (_s, act) => ({
    ok: true,
    events: [
      {
        audience: `player:${act.playerId}`,
        event: { player: act.playerId, side: act.action.value },
      },
    ],
    signals: [],
  }),
  evolve: (s, e) => ({ ...s, [e.player]: e.side }),
  views: { player: (s) => s, spectator: () => ({}), result: (s) => ({ picks: s }) },
  viewSchemas: { player: z.unknown(), spectator: z.unknown(), result: z.unknown() },
  phased: {
    plan: () => ({ entryEndMs: 5_000, actionsEndMs: 8_000, endMs: 10_000, viewDelayMs: 2_000 }),
    series: () => null,
    outcome: (s) => Object.keys(s).map((playerId) => ({ playerId, won: true, points: 1 })),
  },
};
