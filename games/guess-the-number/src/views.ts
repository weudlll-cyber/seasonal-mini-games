/**
 * @file   games/guess-the-number/src/views.ts
 * @module games/guess-the-number
 * @brief  What a player, a spectator and the result page see of a round, with their schemas.
 *
 * Responsibility: the player view (own range, own guesses with answers and comments, and the
 *                 other players' latest guesses), the spectator view (every player's latest
 *                 guesses) and the result with the secrets and the round's range. The guesses,
 *                 at the round's visibility and with Frost's cut, are the guess engine's
 *                 (04 §4.7; 02 §6.2, O21, DECISIONS T73, T74); this game adds its range, the
 *                 fallen numbers and the hint. No view holds a range narrowed from the answers
 *                 (O17), and while the range is hidden no view holds the range at all: `range`
 *                 is null until the result reveals it with the secret (O19, T52). Only
 *                 `result` takes the secrets; it alone carries the closest miss (O22).
 *                 `reveal` words the secret for the chat's round-end line (O32).
 * Depends on:     zod, @smg/game-sdk (GameViews, Range, formatNumber), @smg/guess-engine (views),
 *                 ./closestMiss, ./secrets, ./state
 * Used by:        ./module
 * Spec:           docs/spec/02-game-guess-the-number.md §6, §9, §11, §12; docs/spec/05-security-threat-model.md §3
 */
import { formatNumber, type GameViews, type Range } from '@smg/game-sdk';
import { guessSchemas, othersGuesses, ownGuesses, resultGuesses } from '@smg/guess-engine';
import { z } from 'zod';

import { closestMiss } from './closestMiss.js';
import type { Secrets } from './secrets.js';
import type { GtnState } from './state.js';

// The newest guesses of others a view carries, named for the game's tests (DECISIONS T74).
export { LOG_LIMIT } from '@smg/guess-engine';

const range = z.object({ low: z.number().int(), high: z.number().int() }).strict();
const hint = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('lastDigit'), digit: z.number().int().min(0).max(9) }).strict(),
    z.object({ kind: z.literal('half'), low: z.number().int(), high: z.number().int() }).strict(),
  ])
  .nullable();
const guesses = guessSchemas(z.number().int(), z.enum(['higher', 'lower', 'correct']));

export const viewSchemas = {
  player: z
    .object({
      range: range.nullable(),
      removed: z.array(z.number().int()),
      newest: z.array(z.number().int()).max(3),
      guesses: z.array(guesses.own),
      // The other players' guesses, oldest first.
      log: z.array(guesses.other),
      hint,
    })
    .strict(),
  spectator: z
    .object({
      range: range.nullable(),
      removed: z.array(z.number().int()),
      newest: z.array(z.number().int()).max(3),
      hint,
      log: z.array(guesses.other),
    })
    .strict(),
  result: z
    .object({
      range,
      secret: z.number().int().nullable(),
      secrets: z.record(z.string(), z.number().int()).nullable(),
      guesses: guesses.result,
      // Shared mode with a winner: the best wrong guess of anyone else (O22).
      closestMiss: z
        .object({
          playerId: z.string(),
          value: z.number().int(),
          distance: z.number().int().nonnegative(),
        })
        .strict()
        .nullable(),
    })
    .strict(),
};

export type PlayerView = z.infer<typeof viewSchemas.player>;
export type SpectatorView = z.infer<typeof viewSchemas.spectator>;
export type ResultView = z.infer<typeof viewSchemas.result>;

// Removed numbers outside a range drop out of view (03 §4).
const within = (removed: readonly number[], r: Range) =>
  removed.filter((v) => v >= r.low && v <= r.high);

// The range a viewer may see: none while it is hidden.
const shownRange = (state: GtnState, r: Range): Range | null => (state.rangeVisible ? r : null);

export const views: GameViews<GtnState, Secrets> = {
  player: (state, playerId, ctx) => {
    const playerRange = state.players[playerId]?.range ?? state.range;
    return {
      range: shownRange(state, playerRange),
      removed: within(state.removed, playerRange),
      newest: within(state.newest, playerRange),
      guesses: ownGuesses(state, playerId, ctx),
      log: othersGuesses(state, ctx, playerId),
      hint: state.mode === 'shared' ? state.hint : (state.players[playerId]?.hint ?? null),
    };
  },
  spectator: (state, ctx) => ({
    range: shownRange(state, state.range),
    removed: within(state.removed, state.range),
    newest: within(state.newest, state.range),
    // An individual hint is about a player's own number: spectators never see it (02 §11).
    hint: state.mode === 'shared' ? state.hint : null,
    log: othersGuesses(state, ctx, null),
  }),
  result: (state, secrets) => ({
    // The range the round started with, revealed with the secret.
    range: state.initial,
    secret: secrets.mode === 'shared' ? secrets.value : null,
    secrets: secrets.mode === 'individual' ? secrets.byPlayer : null,
    guesses: resultGuesses(state),
    closestMiss: secrets.mode === 'shared' ? closestMiss(state, secrets.value) : null,
  }),
};

// The chat's round-end clause (O32): the shared number, or in individual mode the winner's own.
export function reveal(result: unknown, winner: string | null): string | null {
  const r = result as Pick<ResultView, 'secret' | 'secrets'>;
  if (r.secret !== null) return `the number was ${formatNumber(r.secret)}`;
  const own = winner === null ? undefined : r.secrets?.[winner];
  return own === undefined ? null : `their number was ${formatNumber(own)}`;
}
