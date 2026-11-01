/**
 * @file   games/safecracker/src/fakes.ts
 * @module games/safecracker
 * @brief  Builders for the game's tests: round input, secrets, a guess runner and special calls.
 *
 * Responsibility: a round input with the default config, and `Table`, which validates, decides
 *                 and folds one code the way the platform does once its own checks have
 *                 passed, and fires Spring Herald and Leaf Fall and folds their events, with a
 *                 real round DRBG from a given seed byte (comments and specials draw from it).
 * Depends on:     @smg/game-sdk (contract, crypto entry), @smg/guess-engine (Secrets),
 *                 ./module, ./settings, ./state
 * Used by:        ./*.test.ts
 * Spec:           docs/spec/09-testing-strategy.md §2, §4.1
 */
import type { Decision, Emitted, RoundInput, RoundRng, SecretMode } from '@smg/game-sdk';
import { roundRng, SEED_BYTES } from '@smg/game-sdk/crypto';
import type { Secrets } from '@smg/guess-engine';

import { safecracker } from './module.js';
import type { ScConfig } from './settings.js';
import type { ScEvent, ScState } from './state.js';

export const defaultConfig: ScConfig = {
  codeLength: 4,
  codeDigits: 10,
  digitsPerFall: 1,
  feedbackVisibility: 'full',
  comments: true,
  trendPercent: 33,
  repeatGuessRejected: true,
};

export function input(
  mode: SecretMode,
  players: readonly string[],
  config: Partial<ScConfig> = {},
): RoundInput<ScConfig> {
  return {
    roundId: 'r1',
    roster: players.map((playerId) => ({ playerId, team: null })),
    secretMode: mode,
    season: 'spring',
    halving: false,
    config: { ...defaultConfig, ...config },
  };
}

export const shared = (value: string): Secrets<string> => ({ mode: 'shared', value });
export const individual = (byPlayer: Record<string, string>): Secrets<string> => ({
  mode: 'individual',
  byPlayer,
});

export class Table {
  state: ScState;
  seq = 0;
  readonly rng: RoundRng;

  constructor(
    readonly secrets: Secrets<string>,
    roundInput: RoundInput<ScConfig>,
    seedByte = 7,
  ) {
    this.state = safecracker.createRound(roundInput);
    this.rng = roundRng(new Uint8Array(SEED_BYTES).fill(seedByte));
  }

  private ctx(now: number) {
    return { now, cooldownMs: 3_000, secrets: this.secrets, rng: this.rng };
  }

  private fold(events: readonly Emitted<ScEvent>[]): readonly Emitted<ScEvent>[] {
    for (const e of events) this.state = safecracker.evolve(this.state, e.event);
    return events;
  }

  // The game's part of one guess: its checks, then its decision folded into the state.
  play(playerId: string, value: string, receivedAt = this.seq * 1_000): Decision<ScEvent> {
    const code = safecracker.validate(this.state, playerId, { value });
    if (code !== null) return { ok: false, code };
    this.seq += 1;
    const act = { playerId, receiveSeq: this.seq, receivedAt, action: { value } };
    const decision = safecracker.decide(this.state, act, this.ctx(receivedAt));
    if (decision.ok) this.fold(decision.events);
    return decision;
  }

  spring(): readonly Emitted<ScEvent>[] {
    return this.fold(safecracker.specials?.springHerald?.(this.state, this.ctx(0)) ?? []);
  }

  fall(index: number, releasedBefore = Infinity): readonly Emitted<ScEvent>[] {
    const fall = { index, count: 99, releasedBefore };
    return this.fold(safecracker.specials?.leafFall?.(this.state, this.ctx(0), fall) ?? []);
  }
}
