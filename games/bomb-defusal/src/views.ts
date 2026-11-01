/**
 * @file   games/bomb-defusal/src/views.ts
 * @module games/bomb-defusal
 * @brief  What a player, a spectator and the result page see of a round, with their schemas.
 *
 * Responsibility: the bomb (its wires, the number of cuts, the explosion penalty, the wires
 *                 marked harmless) for everyone; the player's own sequences with answers and
 *                 comments and the others' at the round's visibility, Frost's cut applied (the
 *                 guess engine's, 02c §6, T73, T74); the hint (shared: everyone's; individual:
 *                 the player's own, never a spectator's, 02c §10). An explosion is an answer,
 *                 so it appears exactly where answers do. Only `result` takes the secrets: the
 *                 shared sequence or every player's, and the closest miss (02c §9, O22).
 *                 `reveal` words the secret for the chat's round-end line (O32).
 * Depends on:     zod, @smg/game-sdk (GameViews), @smg/guess-engine (views, closest miss),
 *                 ./state, ./wires
 * Used by:        ./module, ./index
 * Spec:           docs/spec/02c-game-bomb-defusal.md §6, §9, §10; docs/spec/05-security-threat-model.md §3
 */
import type { GameViews } from '@smg/game-sdk';
import {
  closestMissBy,
  guessSchemas,
  othersGuesses,
  ownGuesses,
  resultGuesses,
  type Secrets,
} from '@smg/guess-engine';
import { z } from 'zod';

import type { BdState } from './state.js';
import {
  feedbackSchema,
  sequenceSchema,
  sequenceText,
  wireSchema,
  type Sequence,
} from './wires.js';

const guesses = guessSchemas(sequenceSchema, feedbackSchema);
const wires = z.array(wireSchema);

// The bomb as everyone sees it.
const bomb = {
  wires,
  cuts: z.number().int(),
  penaltyS: z.number().int().nonnegative(),
  harmless: wires,
  hint: wireSchema.nullable(),
};

export const viewSchemas = {
  player: z
    .object({ ...bomb, guesses: z.array(guesses.own), log: z.array(guesses.other) })
    .strict(),
  spectator: z.object({ ...bomb, log: z.array(guesses.other) }).strict(),
  result: z
    .object({
      wires,
      cuts: z.number().int(),
      secret: sequenceSchema.nullable(),
      secrets: z.record(z.string(), sequenceSchema).nullable(),
      guesses: guesses.result,
      // Shared mode with a winner: the other wrong sequence with the longest correct start.
      closestMiss: z
        .object({ playerId: z.string(), value: sequenceSchema, correct: z.number().int() })
        .strict()
        .nullable(),
    })
    .strict(),
};

export type PlayerView = z.infer<typeof viewSchemas.player>;
export type SpectatorView = z.infer<typeof viewSchemas.spectator>;
export type ResultView = z.infer<typeof viewSchemas.result>;

const bombOf = (state: BdState) => ({
  wires: state.wires,
  cuts: state.cuts,
  penaltyS: state.penaltyMs / 1_000,
  harmless: state.harmless,
});

// 02c §9: the longest correct start of anyone but the winner, the earlier on a tie; an
// explosion (no right cut) is not a near miss, so the best being 0 gives no line.
export function closestMiss(state: BdState): ResultView['closestMiss'] {
  const miss = closestMissBy(
    state,
    (f) => f.defused,
    (g) => state.cuts - g.feedback.correct,
  );
  if (miss === null || miss.distance >= state.cuts) return null;
  return { playerId: miss.playerId, value: miss.value, correct: state.cuts - miss.distance };
}

export const views: GameViews<BdState, Secrets<Sequence>> = {
  player: (state, playerId, ctx) => ({
    ...bombOf(state),
    hint: state.mode === 'shared' ? state.hint : (state.players[playerId]?.hint ?? null),
    guesses: ownGuesses(state, playerId, ctx),
    log: othersGuesses(state, ctx, playerId),
  }),
  spectator: (state, ctx) => ({
    ...bombOf(state),
    // An individual hint is about a player's own bomb: spectators never see it (02c §10).
    hint: state.mode === 'shared' ? state.hint : null,
    log: othersGuesses(state, ctx, null),
  }),
  result: (state, secrets) => ({
    wires: state.wires,
    cuts: state.cuts,
    secret: secrets.mode === 'shared' ? secrets.value : null,
    secrets: secrets.mode === 'individual' ? secrets.byPlayer : null,
    guesses: resultGuesses(state),
    closestMiss: secrets.mode === 'shared' ? closestMiss(state) : null,
  }),
};

// The chat's round-end clause (O32): the shared sequence, or in individual mode the winner's.
export function reveal(result: unknown, winner: string | null): string | null {
  const r = result as Pick<ResultView, 'secret' | 'secrets'>;
  if (r.secret !== null) return `the sequence was ${sequenceText(r.secret)}`;
  const own = winner === null ? undefined : r.secrets?.[winner];
  return own === undefined ? null : `their sequence was ${sequenceText(own)}`;
}
