/**
 * @file   games/seasonal-target/src/secrets.ts
 * @module games/seasonal-target
 * @brief  The round's target cells: the guess engine's secrets with a uniform draw on the map.
 *
 * Responsibility: one uniform cell of the map per secret (column, then row, from the DRBG of
 *                 `secret/shared` or `secret/<playerId>`), so anyone with the revealed seed and
 *                 the settings recomputes them (02d §2, 02 §10). A target carries the round's
 *                 answer rule (mode and map) beside its cell, because the engine's `answer`
 *                 sees only the guess and the secret; only the cell is ever shown, in the result.
 * Depends on:     @smg/game-sdk (Drbg), @smg/guess-engine (Secrets), ./geometry, ./settings
 * Used by:        ./module, ./rules, ./specials, ./leafFall, ./views, ./conformance
 * Spec:           docs/spec/02d-game-seasonal-target.md §1, §5; docs/spec/04-software-architecture.md §4.7
 */
import type { Drbg } from '@smg/game-sdk';
import type { Secrets as EngineSecrets } from '@smg/guess-engine';

import type { AnswerRule, Cell } from './geometry.js';
import type { StConfig } from './settings.js';

export interface Target extends Cell {
  readonly rule: AnswerRule;
}

export type Secrets = EngineSecrets<Target>;

export const ruleOf = (config: StConfig): AnswerRule => ({
  mode: config.feedback,
  map: { width: config.width, height: config.height },
});

// One target: a uniform column, then a uniform row.
export function drawSecret(rng: Drbg, config: StConfig): Target {
  const x = rng.intBetween(1, config.width);
  const y = rng.intBetween(1, config.height);
  return { x, y, rule: ruleOf(config) };
}

// Only the cell: what the result shows and what a fall must never hit.
export const cellOf = (t: Target): Cell => ({ x: t.x, y: t.y });
