/**
 * @file   packages/application/src/round/verify.ts
 * @module application/round
 * @brief  Check an ended round's fairness proof from its public log.
 *
 * Responsibility: what anyone can do with the published data (02 §10): the revealed seed
 *                 hashes to the commitment published at creation, and the secrets derived
 *                 from it with the published settings and roster are the round's secrets.
 * Depends on:     @smg/domain (round events, round input), @smg/game-sdk (module, crypto entry)
 * Used by:        ../index, apps/server (GET /rounds/:id/verify)
 * Spec:           docs/spec/02-game-guess-the-number.md §10; docs/spec/06-data-model-api-realtime.md §3.1
 */
import { initialRound, roundInput, type RoundEvent } from '@smg/domain';
import type { GameModule } from '@smg/game-sdk';
import { roundRng, verifyCommitment } from '@smg/game-sdk/crypto';

export type Verified<Sec> =
  { readonly ok: true; readonly secrets: Sec } | { readonly ok: false; readonly problem: string };

export function verifyRound<S, A, E, Cfg, Sec>(
  module: GameModule<S, A, E, Cfg, Sec>,
  log: readonly RoundEvent<E, A, Cfg>[],
): Verified<Sec> {
  const created = log.find((e) => e.type === 'RoundCreated');
  const countdown = log.find((e) => e.type === 'CountdownStarted');
  const ended = log.find((e) => e.type === 'RoundEnded');
  if (created === undefined || countdown === undefined || ended === undefined) {
    return { ok: false, problem: 'the round has not ended' };
  }
  if (created.commitment === null || ended.seed === null) {
    return { ok: false, problem: 'this round has no fairness proof' };
  }
  const seed = Buffer.from(ended.seed, 'hex');
  if (!verifyCommitment(seed, Buffer.from(created.commitment, 'hex'))) {
    return { ok: false, problem: 'the revealed seed does not match the commitment' };
  }
  const input = roundInput(initialRound<S, A, E, Cfg>(created), countdown.roster);
  return { ok: true, secrets: module.deriveSecrets(input, roundRng(seed)) };
}
