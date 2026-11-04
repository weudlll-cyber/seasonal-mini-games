/**
 * @file   packages/guess-engine/src/fakes.ts
 * @module guess-engine
 * @brief  A toy guessing game for the engine's tests: find a number from 1 to 20.
 *
 * Responsibility: the smallest game on the engine — the answer "up", "down" or "hit", a tier
 *                 by percent of the range, an extra cooldown of 500 ms after a guess of 1, its
 *                 own `Bonus` event — and `play`, which validates, decides and folds one guess
 *                 the way the platform does, with a real round DRBG.
 * Depends on:     zod, @smg/game-sdk (contract, crypto entry), ./index
 * Used by:        ./engine.test, ./parts.test
 * Spec:           docs/spec/04-software-architecture.md §4.7; docs/spec/09-testing-strategy.md §2
 */
import type { Decision, RoundInput, SecretMode } from '@smg/game-sdk';
import { roundRng, SEED_BYTES } from '@smg/game-sdk/crypto';
import { z } from 'zod';

import {
  baseState,
  commentPicker,
  guessModule,
  guessSchemas,
  othersGuesses,
  ownGuesses,
  readGuessConfig,
  resultGuesses,
  tierByPercent,
  type CommentLines,
  type GuessBase,
  type GuessConfig,
  type GuessEvent,
  type Secrets,
} from './index.js';

export type Toy = 'up' | 'down' | 'hit';
export interface ToyState extends GuessBase<number, Toy> {
  readonly bonus: number;
}
type Bonus = { readonly type: 'Bonus' };
export type ToyEvent = GuessEvent<number, Toy> | Bonus;

const lines = (tag: string) => [
  `${tag} one`,
  `${tag} two`,
  { text: `${tag} spring`, season: 'spring' as const },
];
export const TOY_LINES: CommentLines = {
  wayOff: lines('way off'),
  cold: lines('cold'),
  cool: lines('cool'),
  warm: lines('warm'),
  hot: lines('hot'),
  burning: lines('burning'),
  justMissed: lines('just missed'),
  correct: lines('correct'),
  closer: lines('closer'),
  farther: lines('farther'),
};

const schemas = guessSchemas(z.number().int(), z.enum(['up', 'down', 'hit']));
const thresholds = { wayOff: 50, cold: 25, cool: 10, warm: 5, hot: 1 };

export const toy = guessModule<ToyState, number, Toy, Bonus, GuessConfig, number>({
  meta: {
    id: 'toy',
    name: 'Toy',
    contractVersion: 1,
    timing: 'cooldown',
    secretModes: ['shared', 'individual'],
    teams: false,
  },
  settings: { defs: [], read: readGuessConfig, problem: () => null },
  valueSchema: z.number().int().min(1).max(20),
  drawSecret: (rng) => rng.intBetween(1, 20),
  createState: (input) => ({ ...baseState<number, Toy>(input), bonus: 0 }),
  rules: {
    unknownPlayer: 'NOT_HERE',
    check: (_state, _playerId, value) => (value === 13 ? 'UNLUCKY' : null),
    same: (a, b) => a === b,
    answer: (value, secret) => (value < secret ? 'up' : value > secret ? 'down' : 'hit'),
    solved: (f) => f === 'hit',
    tier: (_state, value, secret) =>
      value === secret
        ? 'correct'
        : tierByPercent((Math.abs(value - secret) / 19) * 100, thresholds),
    extraCooldownMs: (_state, f) => (f === 'up' ? 0 : 500),
  },
  picker: commentPicker(TOY_LINES),
  evolveGame: (state) => ({ ...state, bonus: state.bonus + 1 }),
  views: {
    player: (state, playerId, ctx) => ({
      guesses: ownGuesses(state, playerId, ctx),
      log: othersGuesses(state, ctx, playerId),
    }),
    spectator: (state, ctx) => ({ log: othersGuesses(state, ctx, null) }),
    result: (state) => ({ guesses: resultGuesses(state) }),
  },
  viewSchemas: {
    player: z.object({ guesses: z.array(schemas.own), log: z.array(schemas.other) }).strict(),
    spectator: z.object({ log: z.array(schemas.other) }).strict(),
    result: z.object({ guesses: schemas.result }).strict(),
  },
});

export function toyInput(
  mode: SecretMode,
  config: Partial<GuessConfig> = {},
  players: readonly string[] = ['a', 'b', 'c'],
): RoundInput<GuessConfig> {
  return {
    roundId: 'toy',
    roster: players.map((playerId) => ({ playerId, team: null })),
    secretMode: mode,
    season: 'spring',
    halving: false,
    config: {
      feedbackVisibility: 'full',
      comments: true,
      trendPercent: 50,
      repeatGuessRejected: true,
      ...config,
    },
  };
}

// One round of the toy game, played as the platform plays it.
export class ToyTable {
  state: ToyState;
  seq = 0;
  readonly rng = roundRng(new Uint8Array(SEED_BYTES).fill(3));
  readonly secrets: Secrets<number>;

  constructor(input: RoundInput<GuessConfig>, secrets?: Secrets<number>) {
    this.state = toy.createRound(input);
    this.secrets = secrets ?? toy.deriveSecrets(input, this.rng);
  }

  play(playerId: string, value: number, receivedAt = this.seq * 1_000): Decision<ToyEvent> {
    const code = toy.validate(this.state, playerId, { value });
    if (code !== null) return { ok: false, code };
    this.seq += 1;
    const act = { playerId, receiveSeq: this.seq, receivedAt, action: { value } };
    const ctx = { now: receivedAt, cooldownMs: 3_000, secrets: this.secrets, rng: this.rng };
    const decision = toy.decide(this.state, act, ctx);
    if (decision.ok) for (const e of decision.events) this.state = toy.evolve(this.state, e.event);
    return decision;
  }
}
