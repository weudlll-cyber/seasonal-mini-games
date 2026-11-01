/**
 * @file   games/guess-the-number/src/secrets.ts
 * @module games/guess-the-number
 * @brief  The round's secret numbers, derived from the round randomness, never stored.
 *
 * Responsibility: one uniform secret in the range for the shared mode (label
 *                 `secret/shared`) or one per roster player (`secret/<playerId>`), so anyone
 *                 with the revealed seed and the settings recomputes them (02 §10).
 * Depends on:     @smg/game-sdk (RoundInput, RoundRng), ./settings
 * Used by:        ./module, ./rules, ./views
 * Spec:           docs/spec/04-software-architecture.md §5.4, docs/spec/05-security-threat-model.md §3
 */
import type { RoundInput, RoundRng } from '@smg/game-sdk';

import type { GtnConfig } from './settings.js';

export type Secrets =
  | { readonly mode: 'shared'; readonly value: number }
  | { readonly mode: 'individual'; readonly byPlayer: Readonly<Record<string, number>> };

export function deriveSecrets(input: RoundInput<GtnConfig>, rng: RoundRng): Secrets {
  const { rangeLow, rangeHigh } = input.config;
  if (input.secretMode === 'shared') {
    return { mode: 'shared', value: rng.child('secret', 'shared').intBetween(rangeLow, rangeHigh) };
  }
  const byPlayer = Object.fromEntries(
    input.roster.map((p) => [
      p.playerId,
      rng.child('secret', p.playerId).intBetween(rangeLow, rangeHigh),
    ]),
  );
  return { mode: 'individual', byPlayer };
}

export function secretOf(secrets: Secrets, playerId: string): number {
  if (secrets.mode === 'shared') return secrets.value;
  const value = secrets.byPlayer[playerId];
  if (value === undefined) throw new Error(`no secret for ${playerId}`);
  return value;
}
