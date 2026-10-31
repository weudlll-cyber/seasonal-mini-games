/**
 * @file   games/guess-the-number/src/views.ts
 * @module games/guess-the-number
 * @brief  What a player, a spectator and the result page see of a round, with their schemas.
 *
 * Responsibility: the player view (own range, own guesses with answers and comments, and the
 *                 other players' latest guesses), the spectator view (every player's latest
 *                 guesses) and the result with the secrets and the round's range. The guesses
 *                 of others follow the round's visibility (02 §6.2): the number from
 *                 `numbers` on, the answer with its closeness comment only under `full` in
 *                 shared mode, so a viewer sees a comment exactly when they see the answer
 *                 (O21, DECISIONS T73); views keep the newest 60 of them (T74). No view holds a
 *                 range narrowed from the answers (O17), and while the range is hidden no view
 *                 holds the range at all: `range` is null until the result reveals it with
 *                 the secret (O19, T52). Answers and comments of guesses received at or after
 *                 `releasedBefore` are still held by Frost and appear in no view. Only
 *                 `result` takes the secrets.
 * Depends on:     zod, @smg/game-sdk (GameViews, Range), ./closeness, ./secrets, ./state
 * Used by:        ./module
 * Spec:           docs/spec/02-game-guess-the-number.md §6, §9, §11, §12; docs/spec/05-security-threat-model.md §3
 */
import type { GameViews, Range, ViewCtx } from '@smg/game-sdk';
import { z } from 'zod';

import { TIERS } from './closeness.js';
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
// What a viewer sees of one guess: null where the visibility or Frost hides it.
const seen = {
  receiveSeq: z.number().int(),
  receivedAt: z.number().int(),
  feedback: feedback.nullable(),
  tier: z.enum(TIERS).nullable(),
  comment: z.string().nullable(),
};
const ownGuess = z.object({ ...seen, value: z.number().int() }).strict();
const otherGuess = z
  .object({ ...seen, playerId: z.string(), value: z.number().int().nullable() })
  .strict();

export const viewSchemas = {
  player: z
    .object({
      range: range.nullable(),
      removed: z.array(z.number().int()),
      guesses: z.array(ownGuess),
      // The other players' guesses, oldest first.
      log: z.array(otherGuess),
      hint,
    })
    .strict(),
  spectator: z
    .object({
      range: range.nullable(),
      removed: z.array(z.number().int()),
      hint,
      log: z.array(otherGuess),
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

// The newest guesses of others a view carries (DECISIONS T74).
export const LOG_LIMIT = 60;

const released = (g: Guess, ctx: ViewCtx) => g.receivedAt < ctx.releasedBefore;

// The answer and its comment, or nulls while Frost holds them or the viewer may not see them.
function answerOf(g: Guess, shown: boolean) {
  return {
    feedback: shown ? g.feedback : null,
    tier: shown ? (g.comment?.tier ?? null) : null,
    comment: shown ? (g.comment?.text ?? null) : null,
  };
}

// Every player's guesses but `except`'s, the newest LOG_LIMIT, at the round's visibility.
function logOf(state: GtnState, ctx: ViewCtx, except: string | null) {
  const shared = state.mode === 'shared';
  const numbers = shared && state.visibility !== 'own';
  const full = shared && state.visibility === 'full';
  return Object.entries(state.players)
    .filter(([id]) => id !== except)
    .flatMap(([playerId, p]) => p.guesses.map((g) => ({ playerId, g })))
    .sort((x, y) => x.g.receiveSeq - y.g.receiveSeq)
    .slice(-LOG_LIMIT)
    .map(({ playerId, g }) => ({
      receiveSeq: g.receiveSeq,
      receivedAt: g.receivedAt,
      playerId,
      value: numbers ? g.value : null,
      ...answerOf(g, full && released(g, ctx)),
    }));
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
        ...answerOf(g, released(g, ctx)),
      })),
      log: logOf(state, ctx, playerId),
      hint: state.mode === 'shared' ? state.hint : (p?.hint ?? null),
    };
  },
  spectator: (state, ctx) => ({
    range: shownRange(state, state.range),
    removed: within(state.removed, state.range),
    // An individual hint is about a player's own number: spectators never see it (02 §11).
    hint: state.mode === 'shared' ? state.hint : null,
    log: logOf(state, ctx, null),
  }),
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
