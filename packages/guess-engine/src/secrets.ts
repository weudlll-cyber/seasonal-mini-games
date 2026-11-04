/**
 * @file   packages/guess-engine/src/secrets.ts
 * @module guess-engine
 * @brief  A round's secrets: one shared, or one per roster player, drawn from the round randomness.
 *
 * Responsibility: one draw of the game's `draw` per secret, under the label `secret/shared` or
 *                 `secret/<playerId>`, so anyone with the revealed seed and the settings
 *                 recomputes them (02 §10); never stored, never part of a state (05 §3).
 * Depends on:     @smg/game-sdk (RoundInput, RoundRng, Drbg)
 * Used by:        ./index, ./rules, ./module, games/* (their secret binding)
 * Spec:           docs/spec/04-software-architecture.md §4.7, §5.4; docs/spec/05-security-threat-model.md §3
 */
import type { Drbg, RoundInput, RoundRng } from '@smg/game-sdk';

export type Secrets<T> =
  | { readonly mode: 'shared'; readonly value: T }
  | { readonly mode: 'individual'; readonly byPlayer: Readonly<Record<string, T>> };

export function deriveSecrets<T, Cfg>(
  input: RoundInput<Cfg>,
  rng: RoundRng,
  draw: (rng: Drbg) => T,
): Secrets<T> {
  if (input.secretMode === 'shared') {
    return { mode: 'shared', value: draw(rng.child('secret', 'shared')) };
  }
  const byPlayer = Object.fromEntries(
    input.roster.map((p) => [p.playerId, draw(rng.child('secret', p.playerId))]),
  );
  return { mode: 'individual', byPlayer };
}

export function secretOf<T>(secrets: Secrets<T>, playerId: string): T {
  if (secrets.mode === 'shared') return secrets.value;
  const value = secrets.byPlayer[playerId];
  if (value === undefined) throw new Error(`no secret for ${playerId}`);
  return value;
}

// Every secret of the round: the shared one, or each player's.
export const allSecrets = <T>(secrets: Secrets<T>): T[] =>
  secrets.mode === 'shared' ? [secrets.value] : Object.values(secrets.byPlayer);
