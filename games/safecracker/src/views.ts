/**
 * @file   games/safecracker/src/views.ts
 * @module games/safecracker
 * @brief  What a player, a spectator and the result page see of a round, with their schemas.
 *
 * Responsibility: the player view (the code's length and digits in use, the fallen digits, the
 *                 hint the viewer may see, own codes with answers and comments, the others'
 *                 latest codes) and the spectator view (the same without own codes and without
 *                 any individual hint, 02b §9). The guesses, at the round's visibility and with
 *                 Frost's cut, are the guess engine's (04 §4.7; T73, T74). Only `result` takes
 *                 the secrets. `codeDistance` measures a code for "Closest to winning" (the
 *                 most right places, then the most wrong places, O110). `reveal` words the code
 *                 for the chat's round-end line.
 * Depends on:     zod, @smg/game-sdk (GameViews), @smg/guess-engine (views), ./rules, ./state
 * Used by:        ./module, ./index, ./devBot
 * Spec:           docs/spec/02b-game-safecracker.md §5.2, §8, §9; docs/spec/05-security-threat-model.md §3.1
 */
import type { GameViews } from '@smg/game-sdk';
import {
  guessSchemas,
  othersGuesses,
  ownGuesses,
  resultGuesses,
  type Secrets,
} from '@smg/guess-engine';
import { z } from 'zod';

import { CODE_PATTERN } from './rules.js';
import type { ScState } from './state.js';

const count = z.number().int().nonnegative();
const code = z.string().regex(CODE_PATTERN);
const feedback = z.object({ exact: count, near: count, solved: z.boolean() }).strict();
const hint = z.object({ position: count, digit: count }).strict().nullable();
const guesses = guessSchemas(code, feedback);
// What every view says about the code without revealing it (02b §9).
const board = { length: count, digits: count, fallen: z.array(count), hint };

export const viewSchemas = {
  player: z
    .object({ ...board, guesses: z.array(guesses.own), log: z.array(guesses.other) })
    .strict(),
  spectator: z.object({ ...board, log: z.array(guesses.other) }).strict(),
  result: z
    .object({
      length: count,
      digits: count,
      secret: code.nullable(),
      secrets: z.record(z.string(), code).nullable(),
      guesses: guesses.result,
    })
    .strict(),
};

export type PlayerView = z.infer<typeof viewSchemas.player>;
export type SpectatorView = z.infer<typeof viewSchemas.spectator>;
export type ResultView = z.infer<typeof viewSchemas.result>;

// How far a code is from the safe's, in one number (02b §8, O110): fewer digits in their
// place first, then fewer right digits in a wrong place (near ≤ length − exact); 0 opens it.
export const codeDistance = (f: { exact: number; near: number }, length: number): number =>
  (length - f.exact) * (length + 1) + (length - f.exact - f.near);

const board0 = (state: ScState) => ({
  length: state.length,
  digits: state.digits,
  fallen: [...state.fallen],
});

export const views: GameViews<ScState, Secrets<string>> = {
  player: (state, playerId, ctx) => ({
    ...board0(state),
    hint: state.mode === 'shared' ? state.hint : (state.players[playerId]?.hint ?? null),
    guesses: ownGuesses(state, playerId, ctx),
    log: othersGuesses(state, ctx, playerId),
  }),
  spectator: (state, ctx) => ({
    ...board0(state),
    // An individual hint is about a player's own code: spectators never see it (02b §9).
    hint: state.mode === 'shared' ? state.hint : null,
    log: othersGuesses(state, ctx, null),
  }),
  result: (state, secrets) => ({
    length: state.length,
    digits: state.digits,
    secret: secrets.mode === 'shared' ? secrets.value : null,
    secrets: secrets.mode === 'individual' ? secrets.byPlayer : null,
    guesses: resultGuesses(state),
  }),
};

// The chat's round-end clause (O32): the shared code, or in individual mode the winner's own.
export function reveal(result: unknown, winner: string | null): string | null {
  const r = result as Pick<ResultView, 'secret' | 'secrets'>;
  if (r.secret !== null) return `the code was ${r.secret}`;
  const own = winner === null ? undefined : r.secrets?.[winner];
  return own === undefined ? null : `their code was ${own}`;
}
