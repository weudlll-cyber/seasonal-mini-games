/**
 * @file   packages/guess-engine/src/views.ts
 * @module guess-engine
 * @brief  The guesses a viewer may see, and their schemas, for a game's player, spectator and result views.
 *
 * Responsibility: the viewer's own guesses with their answers and comments, and the other
 *                 players' newest 60 (T74) at the round's visibility (02 §6.2): the guess itself
 *                 from `numbers` on, the answer with its closeness comment only under `full` in
 *                 shared mode, so a viewer sees a comment exactly when they see the answer
 *                 (O21, T73). Answers and comments of guesses received at or after
 *                 `releasedBefore` are still held by Frost and appear in no view. The result's
 *                 guesses with their answers, and the zod schemas of all three, built from a
 *                 game's value and feedback schemas. A game adds its own view parts around them.
 * Depends on:     zod, @smg/game-sdk (ViewCtx), ./state, ./tiers
 * Used by:        ./index, games/*
 * Spec:           docs/spec/04-software-architecture.md §4.7; docs/spec/02-game-guess-the-number.md §6, §11
 */
import type { ViewCtx } from '@smg/game-sdk';
import { z, type ZodType } from 'zod';

import type { Guess, GuessBase } from './state.js';
import { TIERS } from './tiers.js';

// The newest guesses of others a view carries (DECISIONS T74).
export const LOG_LIMIT = 60;

const released = (g: { readonly receivedAt: number }, ctx: ViewCtx): boolean =>
  g.receivedAt < ctx.releasedBefore;

// The answer and its comment, or nulls while Frost holds them or the viewer may not see them.
function answerOf<F>(g: Guess<unknown, F>, shown: boolean) {
  return {
    feedback: shown ? g.feedback : null,
    tier: shown ? (g.comment?.tier ?? null) : null,
    comment: shown ? (g.comment?.text ?? null) : null,
  };
}

// The viewer's own guesses, the answers Frost has delivered.
export function ownGuesses<V, F>(state: GuessBase<V, F>, playerId: string, ctx: ViewCtx) {
  return (state.players[playerId]?.guesses ?? []).map((g) => ({
    receiveSeq: g.receiveSeq,
    // The client shows "answer arriving… 2 s" from it under Frost.
    receivedAt: g.receivedAt,
    value: g.value,
    ...answerOf(g, released(g, ctx)),
  }));
}

// Every player's guesses but `except`'s, the newest LOG_LIMIT, at the round's visibility.
export function othersGuesses<V, F>(state: GuessBase<V, F>, ctx: ViewCtx, except: string | null) {
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

// After the end: every player's guesses with their answers.
export function resultGuesses<V, F>(state: GuessBase<V, F>) {
  return Object.fromEntries(
    Object.entries(state.players).map(([id, p]) => [
      id,
      p.guesses.map((g) => ({ value: g.value, feedback: g.feedback })),
    ]),
  );
}

// The schemas of the three lists above, from the game's value and feedback schemas.
export function guessSchemas<V extends ZodType, F extends ZodType>(value: V, feedback: F) {
  // What a viewer sees of one guess: null where the visibility or Frost hides it.
  const seen = {
    receiveSeq: z.number().int(),
    receivedAt: z.number().int(),
    feedback: feedback.nullable(),
    tier: z.enum(TIERS).nullable(),
    comment: z.string().nullable(),
  };
  return {
    own: z.object({ ...seen, value }).strict(),
    other: z.object({ ...seen, playerId: z.string(), value: value.nullable() }).strict(),
    result: z.record(z.string(), z.array(z.object({ value, feedback }).strict())),
  };
}
