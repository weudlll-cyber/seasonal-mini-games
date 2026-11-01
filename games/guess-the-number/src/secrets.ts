/**
 * @file   games/guess-the-number/src/secrets.ts
 * @module games/guess-the-number
 * @brief  The round's secret numbers: the guess engine's secrets with a uniform draw in the range.
 *
 * Responsibility: one uniform secret in the range for the shared mode (label
 *                 `secret/shared`) or one per roster player (`secret/<playerId>`), drawn by the
 *                 guess engine, so anyone with the revealed seed and the settings recomputes
 *                 them (02 §10). The secret's draw is the game's; the rest is the engine's.
 * Depends on:     @smg/game-sdk (RoundInput, RoundRng, Drbg), @smg/guess-engine (secrets),
 *                 ./settings
 * Used by:        ./module, ./rules, ./specials, ./views
 * Spec:           docs/spec/04-software-architecture.md §4.7, §5.4, docs/spec/05-security-threat-model.md §3
 */
import type { Drbg, RoundInput, RoundRng } from '@smg/game-sdk';
import { deriveSecrets as derive, type Secrets as EngineSecrets } from '@smg/guess-engine';

import type { GtnConfig } from './settings.js';

export { secretOf } from '@smg/guess-engine';

export type Secrets = EngineSecrets<number>;

// One secret: a uniform whole number in the range.
export const drawSecret = (rng: Drbg, config: GtnConfig): number =>
  rng.intBetween(config.rangeLow, config.rangeHigh);

export const deriveSecrets = (input: RoundInput<GtnConfig>, rng: RoundRng): Secrets =>
  derive(input, rng, (r) => drawSecret(r, input.config));
