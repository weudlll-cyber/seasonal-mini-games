/**
 * @file   games/guess-the-number/src/state.ts
 * @module games/guess-the-number
 * @brief  Game state and events of a round, and how events change the state.
 *
 * Responsibility: per roster player the current range and the accepted guesses with their
 *                 answers; the removed numbers; the shared band under `full` visibility.
 *                 No secret is ever part of the state (05 §3). `GuessFed` is the room's
 *                 line about a guess, shaped by the visibility, and changes nothing.
 * Depends on:     @smg/game-sdk (Range, RoundInput), ./feedback, ./settings
 * Used by:        ./module, ./rules, ./views
 * Spec:           docs/spec/02-game-guess-the-number.md §5, §6; docs/spec/06-data-model-api-realtime.md §2.7
 */
import type { Range, RoundInput, SecretMode } from '@smg/game-sdk';

import { band, type Feedback } from './feedback.js';
import type { GtnConfig, Visibility } from './settings.js';

export interface Guess {
  readonly receiveSeq: number;
  readonly receivedAt: number;
  readonly value: number;
  readonly feedback: Feedback;
}

export interface PlayerState {
  readonly range: Range;
  readonly guesses: readonly Guess[];
  // The intersection of this player's answers with their range (kept for the hot path).
  readonly band: Range;
}

export interface GtnState {
  readonly mode: SecretMode;
  readonly visibility: Visibility;
  readonly repeatRejected: boolean;
  readonly initial: Range;
  // Numbers no one may guess any more (Leaf Fall), ascending.
  readonly removed: readonly number[];
  readonly players: Readonly<Record<string, PlayerState>>;
  // Shared mode: the intersection of every player's answers with the range.
  readonly sharedBand: Range;
}

export type GtnEvent =
  | {
      readonly type: 'FeedbackGiven';
      readonly playerId: string;
      readonly receiveSeq: number;
      readonly receivedAt: number;
      readonly value: number;
      readonly feedback: Feedback;
      readonly band: Range;
    }
  | {
      readonly type: 'GuessFed';
      readonly playerId: string;
      readonly guesses: number;
      readonly value?: number;
      readonly feedback?: Feedback;
      readonly sharedBand?: Range;
    };

export function createState(input: RoundInput<GtnConfig>): GtnState {
  const initial = { low: input.config.rangeLow, high: input.config.rangeHigh };
  const players = Object.fromEntries(
    input.roster.map((p) => [p.playerId, { range: initial, guesses: [], band: initial }]),
  );
  return {
    mode: input.secretMode,
    visibility: input.config.feedbackVisibility,
    repeatRejected: input.config.repeatGuessRejected,
    initial,
    removed: [],
    players,
    sharedBand: initial,
  };
}

export function evolve(state: GtnState, event: GtnEvent): GtnState {
  if (event.type === 'GuessFed') return state;
  const player = state.players[event.playerId];
  if (player === undefined) return state;
  const { playerId, receiveSeq, receivedAt, value, feedback } = event;
  const guess: Guess = { receiveSeq, receivedAt, value, feedback };
  const next: PlayerState = { ...player, guesses: [...player.guesses, guess], band: event.band };
  const sharedBand = state.mode === 'shared' ? band(state.sharedBand, [guess]) : state.sharedBand;
  return { ...state, players: { ...state.players, [playerId]: next }, sharedBand };
}
