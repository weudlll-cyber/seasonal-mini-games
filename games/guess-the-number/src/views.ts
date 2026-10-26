/**
 * @file   games/guess-the-number/src/views.ts
 * @module games/guess-the-number
 * @brief  What a player, a spectator and the result page see of a round, with their schemas.
 *
 * Responsibility: the player view (own range, own guesses and answers), the spectator view
 *                 at the round's visibility (02 §6.2, §11) and the result with the secrets and
 *                 the round's range. No view holds a range narrowed from the answers (O17),
 *                 and while the range is hidden no view holds the range at all: `range` is
 *                 null until the result reveals it with the secret (O19, DECISIONS T52).
 *                 Answers to guesses received at or after `releasedBefore` are still held
 *                 by Frost and appear in no view. Only `result` takes the secrets.
 * Depends on:     zod, @smg/game-sdk (GameViews, Range), ./feedback, ./secrets, ./state
 * Used by:        ./module
 * Spec:           docs/spec/02-game-guess-the-number.md §6, §9, §11, §12; docs/spec/05-security-threat-model.md §3
 */
import type { GameViews, Range, ViewCtx } from '@smg/game-sdk';
import { z } from 'zod';

import type { Feedback } from './feedback.js';
import type { Secrets } from './secrets.js';
import type { Guess, GtnState } from './state.js';

const range = z.object({ low: z.number().int(), high: z.number().int() }).strict();
const feedback = z.enum(['higher', 'lower', 'correct']);
const hint = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('parity'), odd: z.boolean() }).strict(),
    z.object({ kind: z.literal('half'), low: z.number().int(), high: z.number().int() }).strict(),
  ])
  .nullable();
const ownGuess = z
  .object({
    receiveSeq: z.number().int(),
    receivedAt: z.number().int(),
    value: z.number().int(),
    feedback: feedback.nullable(),
  })
  .strict();

export const viewSchemas = {
  player: z
    .object({
      range: range.nullable(),
      removed: z.array(z.number().int()),
      guesses: z.array(ownGuess),
      hint,
    })
    .strict(),
  spectator: z
    .object({
      range: range.nullable(),
      removed: z.array(z.number().int()),
      hint,
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
      range,
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
export type SpectatorView = z.infer<typeof viewSchemas.spectator>;
export type ResultView = z.infer<typeof viewSchemas.result>;

const released = (g: Guess, ctx: ViewCtx) => g.receivedAt < ctx.releasedBefore;

function shownFeedback(g: Guess, ctx: ViewCtx): Feedback | null {
  return released(g, ctx) ? g.feedback : null;
}

// Removed numbers outside a range drop out of view (03 §4).
const within = (removed: readonly number[], r: Range) =>
  removed.filter((v) => v >= r.low && v <= r.high);

// The range a viewer may see: none while it is hidden.
const shownRange = (state: GtnState, r: Range): Range | null => (state.rangeVisible ? r : null);

export const views: GameViews<GtnState, Secrets> = {
  player: (state, playerId, ctx) => {
    const p = state.players[playerId];
    const own = p?.guesses ?? [];
    const playerRange = p?.range ?? state.range;
    return {
      range: shownRange(state, playerRange),
      removed: within(state.removed, playerRange),
      guesses: own.map((g) => ({
        receiveSeq: g.receiveSeq,
        // The client shows "answer arriving in 2 s" from it under Frost.
        receivedAt: g.receivedAt,
        value: g.value,
        feedback: shownFeedback(g, ctx),
      })),
      hint: state.mode === 'shared' ? state.hint : (p?.hint ?? null),
    };
  },
  spectator: (state, ctx) => {
    const shared = state.mode === 'shared';
    const numbers = shared && state.visibility !== 'own';
    const full = shared && state.visibility === 'full';
    return {
      range: shownRange(state, state.range),
      removed: within(state.removed, state.range),
      // An individual hint is about a player's own number: spectators never see it (02 §11).
      hint: shared ? state.hint : null,
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
    // The range the round started with, revealed with the secret.
    range: state.initial,
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
