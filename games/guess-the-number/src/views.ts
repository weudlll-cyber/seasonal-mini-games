/**
 * @file   games/guess-the-number/src/views.ts
 * @module games/guess-the-number
 * @brief  What a player, a spectator and the result page see of a round, with their schemas.
 *
 * Responsibility: the player view (own range, band, guesses and answers), the spectator view
 *                 at the round's visibility (02 §6.2, §11) and the result with the secrets.
 *                 Answers to guesses received at or after `releasedBefore` are still held
 *                 by Frost and appear in no view. Only `result` takes the secrets.
 * Depends on:     zod, @smg/game-sdk (GameViews, Range), ./feedback, ./secrets, ./state
 * Used by:        ./module
 * Spec:           docs/spec/02-game-guess-the-number.md §6, §9, §11, §12; docs/spec/05-security-threat-model.md §3
 */
import type { GameViews, Range, ViewCtx } from '@smg/game-sdk';
import { z } from 'zod';

import { band, type Feedback } from './feedback.js';
import type { Secrets } from './secrets.js';
import type { Guess, GtnState } from './state.js';

const range = z.object({ low: z.number().int(), high: z.number().int() }).strict();
const feedback = z.enum(['higher', 'lower', 'correct']);
const ownGuess = z
  .object({ receiveSeq: z.number().int(), value: z.number().int(), feedback: feedback.nullable() })
  .strict();

export const viewSchemas = {
  player: z
    .object({ range, removed: z.array(z.number().int()), band: range, guesses: z.array(ownGuess) })
    .strict(),
  spectator: z
    .object({
      range,
      removed: z.array(z.number().int()),
      sharedBand: range.nullable(),
      players: z.array(
        z
          .object({
            playerId: z.string(),
            guesses: z.number().int(),
            values: z.array(z.number().int()).nullable(),
            answers: z.array(z.object({ value: z.number().int(), feedback }).strict()).nullable(),
          })
          .strict(),
      ),
    })
    .strict(),
  result: z
    .object({
      secret: z.number().int().nullable(),
      secrets: z.record(z.string(), z.number().int()).nullable(),
      guesses: z.record(
        z.string(),
        z.array(z.object({ value: z.number().int(), feedback }).strict()),
      ),
    })
    .strict(),
};

export type PlayerView = z.infer<typeof viewSchemas.player>;

const released = (g: Guess, ctx: ViewCtx) => g.receivedAt < ctx.releasedBefore;

function shownFeedback(g: Guess, ctx: ViewCtx): Feedback | null {
  return released(g, ctx) ? g.feedback : null;
}

function sharedBand(state: GtnState, ctx: ViewCtx): Range | null {
  if (state.mode !== 'shared' || state.visibility !== 'full') return null;
  const answers = Object.values(state.players).flatMap((p) =>
    p.guesses.filter((g) => released(g, ctx)),
  );
  return band(state.initial, answers);
}

export const views: GameViews<GtnState, Secrets> = {
  player: (state, playerId, ctx) => {
    const p = state.players[playerId];
    const own = p?.guesses ?? [];
    const playerRange = p?.range ?? state.initial;
    return {
      range: playerRange,
      removed: state.removed,
      band: band(
        playerRange,
        own.filter((g) => released(g, ctx)),
      ),
      guesses: own.map((g) => ({
        receiveSeq: g.receiveSeq,
        value: g.value,
        feedback: shownFeedback(g, ctx),
      })),
    };
  },
  spectator: (state, ctx) => {
    const shared = state.mode === 'shared';
    const numbers = shared && state.visibility !== 'own';
    const full = shared && state.visibility === 'full';
    return {
      range: state.initial,
      removed: state.removed,
      sharedBand: sharedBand(state, ctx),
      players: Object.entries(state.players).map(([playerId, p]) => ({
        playerId,
        guesses: p.guesses.length,
        values: numbers ? p.guesses.map((g) => g.value) : null,
        answers: full
          ? p.guesses
              .filter((g) => released(g, ctx))
              .map((g) => ({ value: g.value, feedback: g.feedback }))
          : null,
      })),
    };
  },
  result: (state, secrets) => ({
    secret: secrets.mode === 'shared' ? secrets.value : null,
    secrets: secrets.mode === 'individual' ? secrets.byPlayer : null,
    guesses: Object.fromEntries(
      Object.entries(state.players).map(([id, p]) => [
        id,
        p.guesses.map((g) => ({ value: g.value, feedback: g.feedback })),
      ]),
    ),
  }),
};
