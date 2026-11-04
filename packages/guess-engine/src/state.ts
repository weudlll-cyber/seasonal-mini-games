/**
 * @file   packages/guess-engine/src/state.ts
 * @module guess-engine
 * @brief  The part of a guessing game's state the engine owns, its two events, and their folding.
 *
 * Responsibility: per player the accepted guesses with their answers and closeness comments;
 *                 the round's mode, visibility, repeat rule and comment state (the lines used so
 *                 far, T72). A game's state extends this base with its own parts (a range, a
 *                 map, hints, fallen values); the helpers keep those parts as they are.
 *                 `FeedbackGiven` is the answer to the guesser; `GuessFed` is the room's line
 *                 about a guess, shaped by the visibility, and changes nothing. No secret is ever
 *                 part of the state (05 §3).
 * Depends on:     @smg/game-sdk (RoundInput, SecretMode, Season), ./comments
 * Used by:        ./rules, ./views, ./candidates, ./closestMiss, ./module, ./index, games/*
 * Spec:           docs/spec/04-software-architecture.md §4.7; docs/spec/02-game-guess-the-number.md §6
 */
import type { RoundInput, SecretMode, Season } from '@smg/game-sdk';

import type { Comment, CommentPicker, UsedLines } from './comments.js';

export type Visibility = 'own' | 'numbers' | 'full';

export interface Guess<V, F> {
  readonly receiveSeq: number;
  readonly receivedAt: number;
  readonly value: V;
  readonly feedback: F;
  // Null when the round has the comments off.
  readonly comment: Comment | null;
}

export interface GuessPlayer<V, F> {
  readonly guesses: readonly Guess<V, F>[];
}

// The closeness comments (O21): on or off, how often a trend line comes, the season whose own
// lines may come up, and the lines used so far.
export interface CommentState {
  readonly on: boolean;
  readonly trendPercent: number;
  readonly season: Season;
  readonly used: UsedLines;
}

export interface GuessBase<V, F> {
  readonly mode: SecretMode;
  readonly visibility: Visibility;
  readonly repeatRejected: boolean;
  readonly comments: CommentState;
  readonly players: Readonly<Record<string, GuessPlayer<V, F>>>;
}

export type GuessEvent<V, F> =
  | {
      readonly type: 'FeedbackGiven';
      readonly playerId: string;
      readonly receiveSeq: number;
      readonly receivedAt: number;
      readonly value: V;
      readonly feedback: F;
      readonly comment: Comment | null;
    }
  | {
      readonly type: 'GuessFed';
      readonly playerId: string;
      readonly guesses: number;
      readonly value?: V;
      readonly feedback?: F;
      // Only beside the feedback, under `full` (T73).
      readonly comment?: Comment;
    };

// The keys every guessing game reads from its settings document (08 §3, ./settings).
export interface GuessConfig {
  readonly feedbackVisibility: Visibility;
  readonly comments: boolean;
  readonly trendPercent: number;
  readonly repeatGuessRejected: boolean;
}

// The engine's part of a new round: every roster player without a guess.
export function baseState<V, F>(input: RoundInput<GuessConfig>): GuessBase<V, F> {
  const c = input.config;
  return {
    mode: input.secretMode,
    visibility: c.feedbackVisibility,
    repeatRejected: c.repeatGuessRejected,
    comments: { on: c.comments, trendPercent: c.trendPercent, season: input.season, used: {} },
    players: Object.fromEntries(input.roster.map((p) => [p.playerId, { guesses: [] }])),
  };
}

type PlayerOf<S extends GuessBase<unknown, unknown>> = S['players'][string];

// One player changed, every other part of the state (the game's own included) kept.
export function withPlayer<S extends GuessBase<unknown, unknown>>(
  state: S,
  playerId: string,
  change: (p: PlayerOf<S>) => PlayerOf<S>,
): S {
  const player = state.players[playerId] as PlayerOf<S> | undefined;
  if (player === undefined) return state;
  return { ...state, players: { ...state.players, [playerId]: change(player) } };
}

// The engine's events folded in; a `GuessFed` changes nothing.
export function evolveGuess<S extends GuessBase<V, F>, V, F>(
  state: S,
  event: GuessEvent<V, F>,
  picker: CommentPicker,
): S {
  if (event.type === 'GuessFed') return state;
  const { receiveSeq, receivedAt, value, feedback } = event;
  // Answers stored before closeness comments (O21) have no `comment`; the log is never
  // rewritten, so such a round still replays, with no comment (DECISIONS T86).
  const comment = (event.comment as Comment | null | undefined) ?? null;
  const guess: Guess<V, F> = { receiveSeq, receivedAt, value, feedback, comment };
  const next = withPlayer(state, event.playerId, (p) => ({ ...p, guesses: [...p.guesses, guess] }));
  // An unknown player's event changes nothing, its comment included.
  if (comment === null || next === state) return next;
  const c = state.comments;
  return { ...next, comments: { ...c, used: picker.noteUsed(c.used, comment, c.season) } };
}

export const isGuessEvent = (event: { readonly type: string }): boolean =>
  event.type === 'FeedbackGiven' || event.type === 'GuessFed';
