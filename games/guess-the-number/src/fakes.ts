/**
 * @file   games/guess-the-number/src/fakes.ts
 * @module games/guess-the-number
 * @brief  Builders for the game's tests: round input, secrets and a guess runner.
 *
 * Responsibility: a round input with the default config, fixed secrets, and `play`, which
 *                 validates, decides and folds one guess the way the platform does once its
 *                 own checks have passed, with a real round DRBG from a given seed byte (the
 *                 comment lines are drawn from it).
 * Depends on:     @smg/game-sdk (contract, crypto entry), ./module, ./rules, ./secrets,
 *                 ./settings, ./state
 * Used by:        ./*.test.ts, games/registry (conformance suite)
 * Spec:           docs/spec/09-testing-strategy.md §2
 */
import type { Decision, RoundInput, RoundRng, SecretMode } from '@smg/game-sdk';
import { roundRng, SEED_BYTES } from '@smg/game-sdk/crypto';

import { guessTheNumber } from './module.js';
import type { Secrets } from './secrets.js';
import type { GtnConfig } from './settings.js';
import type { GtnEvent, GtnState } from './state.js';

export const defaultConfig: GtnConfig = {
  rangeLow: 1,
  rangeHigh: 1_000,
  rangeVisible: true,
  feedbackVisibility: 'full',
  comments: true,
  thresholds: { wayOff: 50, cold: 25, cool: 10, warm: 3, hot: 1 },
  trendPercent: 33,
  repeatGuessRejected: true,
  springHintType: 'parity',
  autumnMinRemaining: 10,
  halvingMinRangeSize: 8,
};

export function input(
  mode: SecretMode,
  players: readonly string[],
  config: Partial<GtnConfig> = {},
): RoundInput<GtnConfig> {
  return {
    roundId: 'r1',
    roster: players.map((playerId) => ({ playerId, team: null })),
    secretMode: mode,
    season: 'spring',
    halving: false,
    config: { ...defaultConfig, ...config },
  };
}

export class Table {
  state: GtnState;
  seq = 0;
  readonly rng: RoundRng;

  constructor(
    readonly secrets: Secrets,
    roundInput: RoundInput<GtnConfig>,
    seedByte = 7,
  ) {
    this.state = guessTheNumber.createRound(roundInput);
    this.rng = roundRng(new Uint8Array(SEED_BYTES).fill(seedByte));
  }

  // The game's part of one guess: its checks, then its decision folded into the state.
  play(playerId: string, value: number, receivedAt = 0): Decision<GtnEvent> {
    const code = guessTheNumber.validate(this.state, playerId, { value });
    if (code !== null) return { ok: false, code };
    this.seq += 1;
    const act = { playerId, receiveSeq: this.seq, receivedAt, action: { value } };
    const ctx = { now: receivedAt, cooldownMs: 3_000, secrets: this.secrets, rng: this.rng };
    const decision = guessTheNumber.decide(this.state, act, ctx);
    if (decision.ok) {
      for (const e of decision.events) this.state = guessTheNumber.evolve(this.state, e.event);
    }
    return decision;
  }
}
