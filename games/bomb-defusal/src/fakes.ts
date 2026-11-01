/**
 * @file   games/bomb-defusal/src/fakes.ts
 * @module games/bomb-defusal
 * @brief  Builders for the game's tests: round input, secrets and a sequence runner.
 *
 * Responsibility: a round input with the default config (6 wires, 4 cuts, 5 s penalty), and
 *                 `Table.play`, which validates, decides and folds one sequence the way the
 *                 platform does once its own checks have passed, with a real round DRBG from
 *                 a given seed byte (the comment lines are drawn from it).
 * Depends on:     @smg/game-sdk (contract, crypto entry), @smg/guess-engine (Secrets), ./module,
 *                 ./settings, ./state, ./wires
 * Used by:        ./*.test.ts
 * Spec:           docs/spec/09-testing-strategy.md §2
 */
import type { Decision, RoundInput, RoundRng, SecretMode } from '@smg/game-sdk';
import { roundRng, SEED_BYTES } from '@smg/game-sdk/crypto';
import type { Secrets } from '@smg/guess-engine';

import { bombDefusal } from './module.js';
import type { BdConfig } from './settings.js';
import type { BdEvent, BdState } from './state.js';
import type { Sequence } from './wires.js';

export const defaultConfig: BdConfig = {
  wires: 6,
  cuts: 4,
  explosionPenaltyS: 5,
  feedbackVisibility: 'full',
  comments: true,
  trendPercent: 33,
  repeatGuessRejected: true,
  wiresPerFall: 1,
};

export function input(
  mode: SecretMode,
  players: readonly string[],
  config: Partial<BdConfig> = {},
): RoundInput<BdConfig> {
  return {
    roundId: 'r1',
    roster: players.map((playerId) => ({ playerId, team: null })),
    secretMode: mode,
    season: 'autumn',
    halving: false,
    config: { ...defaultConfig, ...config },
  };
}

export class Table {
  state: BdState;
  seq = 0;
  readonly rng: RoundRng;

  constructor(
    readonly secrets: Secrets<Sequence>,
    roundInput: RoundInput<BdConfig>,
    seedByte = 7,
  ) {
    this.state = bombDefusal.createRound(roundInput);
    this.rng = roundRng(new Uint8Array(SEED_BYTES).fill(seedByte));
  }

  // The game's part of one sequence: its checks, then its decision folded into the state.
  play(playerId: string, value: Sequence, receivedAt = this.seq * 1_000): Decision<BdEvent> {
    const code = bombDefusal.validate(this.state, playerId, { value });
    if (code !== null) return { ok: false, code };
    this.seq += 1;
    const act = { playerId, receiveSeq: this.seq, receivedAt, action: { value } };
    const ctx = { now: receivedAt, cooldownMs: 3_000, secrets: this.secrets, rng: this.rng };
    const decision = bombDefusal.decide(this.state, act, ctx);
    if (decision.ok) {
      for (const e of decision.events) this.state = bombDefusal.evolve(this.state, e.event);
    }
    return decision;
  }

  // One fall or hint, folded in.
  fold(events: readonly { readonly event: BdEvent }[]): void {
    for (const e of events) this.state = bombDefusal.evolve(this.state, e.event);
  }
}
