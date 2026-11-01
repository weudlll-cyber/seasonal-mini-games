/**
 * @file   games/seasonal-target/src/fakes.ts
 * @module games/seasonal-target
 * @brief  Builders for the game's tests: round input, targets and a guess runner.
 *
 * Responsibility: a round input with the default config, targets at given cells, and `play`,
 *                 which validates, decides and folds one guess the way the platform does once
 *                 its own checks have passed, with a real round DRBG from a given seed byte
 *                 (the comment lines are drawn from it); `fire` folds a special's events.
 * Depends on:     @smg/game-sdk (contract, crypto entry), ./geometry, ./module, ./secrets,
 *                 ./settings, ./state
 * Used by:        ./*.test.ts, ../web/*.test.tsx
 * Spec:           docs/spec/09-testing-strategy.md §2
 */
import type { Decision, Emitted, RoundInput, RoundRng, SecretMode } from '@smg/game-sdk';
import { roundRng, SEED_BYTES } from '@smg/game-sdk/crypto';

import type { Cell } from './geometry.js';
import { seasonalTarget } from './module.js';
import { ruleOf, type Secrets, type Target } from './secrets.js';
import type { StConfig } from './settings.js';
import type { StEvent, StState } from './state.js';

export const defaultConfig: StConfig = {
  width: 50,
  height: 50,
  feedback: 'distance',
  feedbackVisibility: 'full',
  comments: true,
  trendPercent: 33,
  repeatGuessRejected: true,
  autumnMinCellsLeft: 10,
  halvingMinCells: 16,
};

export function input(
  mode: SecretMode,
  players: readonly string[],
  config: Partial<StConfig> = {},
): RoundInput<StConfig> {
  return {
    roundId: 'r1',
    roster: players.map((playerId) => ({ playerId, team: null })),
    secretMode: mode,
    season: 'spring',
    halving: false,
    config: { ...defaultConfig, ...config },
  };
}

// Targets at the given cells: one shared, or one per player in roster order.
export function targets(inp: RoundInput<StConfig>, cells: readonly Cell[]): Secrets {
  const t = (c: Cell): Target => ({ x: c.x, y: c.y, rule: ruleOf(inp.config) });
  if (inp.secretMode === 'shared') return { mode: 'shared', value: t(cells[0] ?? { x: 1, y: 1 }) };
  return {
    mode: 'individual',
    byPlayer: Object.fromEntries(
      inp.roster.map((p, k) => [p.playerId, t(cells[k] ?? { x: 1, y: 1 })]),
    ),
  };
}

export class Table {
  state: StState;
  seq = 0;
  readonly rng: RoundRng;

  constructor(
    readonly secrets: Secrets,
    roundInput: RoundInput<StConfig>,
    seedByte = 7,
  ) {
    this.state = seasonalTarget.createRound(roundInput);
    this.rng = roundRng(new Uint8Array(SEED_BYTES).fill(seedByte));
  }

  get ctx() {
    return { now: 0, cooldownMs: 3_000, secrets: this.secrets, rng: this.rng };
  }

  // The game's part of one guess: its checks, then its decision folded into the state.
  play(playerId: string, value: Cell, receivedAt = this.seq * 1_000): Decision<StEvent> {
    const code = seasonalTarget.validate(this.state, playerId, { value });
    if (code !== null) return { ok: false, code };
    this.seq += 1;
    const act = { playerId, receiveSeq: this.seq, receivedAt, action: { value } };
    const decision = seasonalTarget.decide(this.state, act, { ...this.ctx, now: receivedAt });
    if (decision.ok) this.fold(decision.events);
    return decision;
  }

  fold(events: readonly Emitted<StEvent>[]): readonly Emitted<StEvent>[] {
    for (const e of events) this.state = seasonalTarget.evolve(this.state, e.event);
    return events;
  }
}
