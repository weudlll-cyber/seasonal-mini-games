/**
 * @file   games/guess-the-number/src/state.ts
 * @module games/guess-the-number
 * @brief  Game state and events of a round, and how events change the state.
 *
 * Responsibility: per roster player the current range and the accepted guesses with their
 *                 answers; the removed numbers; whether the range is shown (O19); the hints of
 *                 Spring Herald and the windows of halving (03 §2.1, §2.3, §4). Nothing is
 *                 narrowed from the answers (O17). No secret is ever part of the state
 *                 (05 §3). `GuessFed` is the room's line about a guess, shaped by the
 *                 visibility, and changes nothing.
 * Depends on:     @smg/game-sdk (Range, RoundInput), ./feedback, ./settings
 * Used by:        ./module, ./rules, ./views
 * Spec:           docs/spec/02-game-guess-the-number.md §5, §6; docs/spec/06-data-model-api-realtime.md §2.7
 */
import type { Range, RoundInput, SecretMode } from '@smg/game-sdk';

import type { Feedback } from './feedback.js';
import type { GtnConfig, Visibility } from './settings.js';

export interface Guess {
  readonly receiveSeq: number;
  readonly receivedAt: number;
  readonly value: number;
  readonly feedback: Feedback;
}

// Spring Herald's hint: odd or even, or which half of the range (03 §2.1).
export type Hint =
  | { readonly kind: 'parity'; readonly odd: boolean }
  | { readonly kind: 'half'; readonly low: number; readonly high: number };

export interface PlayerState {
  readonly range: Range;
  readonly guesses: readonly Guess[];
  // Individual mode: the hint about the player's own number.
  readonly hint: Hint | null;
}

export interface GtnState {
  readonly mode: SecretMode;
  readonly visibility: Visibility;
  // Off: no client learns the range while the round runs (O19, DECISIONS T52).
  readonly rangeVisible: boolean;
  readonly repeatRejected: boolean;
  readonly specials: {
    readonly hintType: GtnConfig['springHintType'];
    readonly minRemaining: number;
    readonly minRangeSize: number;
  };
  readonly initial: Range;
  // The round's range: shared mode halves it; in individual mode each player's own halves.
  readonly range: Range;
  // Numbers no one may guess any more (Leaf Fall), ascending.
  readonly removed: readonly number[];
  readonly players: Readonly<Record<string, PlayerState>>;
  // Shared mode: the one hint everyone got.
  readonly hint: Hint | null;
}

export type GtnEvent =
  | {
      readonly type: 'FeedbackGiven';
      readonly playerId: string;
      readonly receiveSeq: number;
      readonly receivedAt: number;
      readonly value: number;
      readonly feedback: Feedback;
    }
  | {
      readonly type: 'GuessFed';
      readonly playerId: string;
      readonly guesses: number;
      readonly value?: number;
      readonly feedback?: Feedback;
    }
  // `playerId` null: the shared hint, to everyone.
  | { readonly type: 'HintGiven'; readonly playerId: string | null; readonly hint: Hint }
  | { readonly type: 'NumbersRemoved'; readonly index: number; readonly numbers: readonly number[] }
  // `playerId` null with a range: the shared window; null without one: the room's line
  // that every individual range now has `size` numbers.
  | {
      readonly type: 'RangeHalved';
      readonly index: number;
      readonly playerId: string | null;
      readonly range: Range | null;
      readonly size: number;
    };

export function createState(input: RoundInput<GtnConfig>): GtnState {
  const c = input.config;
  const initial = { low: c.rangeLow, high: c.rangeHigh };
  const players = Object.fromEntries(
    input.roster.map((p) => [p.playerId, { range: initial, guesses: [], hint: null }]),
  );
  return {
    mode: input.secretMode,
    visibility: c.feedbackVisibility,
    rangeVisible: c.rangeVisible,
    repeatRejected: c.repeatGuessRejected,
    specials: {
      // "Which half" names numbers of the range: a hidden range gets odd or even (T56).
      hintType: c.rangeVisible ? c.springHintType : 'parity',
      minRemaining: c.autumnMinRemaining,
      minRangeSize: c.halvingMinRangeSize,
    },
    initial,
    range: initial,
    removed: [],
    players,
    hint: null,
  };
}

export function evolve(state: GtnState, event: GtnEvent): GtnState {
  switch (event.type) {
    case 'GuessFed':
      return state;
    case 'FeedbackGiven':
      return answered(state, event);
    case 'HintGiven':
      return event.playerId === null
        ? { ...state, hint: event.hint }
        : withPlayer(state, event.playerId, (p) => ({ ...p, hint: event.hint }));
    case 'NumbersRemoved':
      return { ...state, removed: [...state.removed, ...event.numbers].sort((a, b) => a - b) };
    case 'RangeHalved':
      return halved(state, event);
  }
}

function withPlayer(
  state: GtnState,
  playerId: string,
  change: (p: PlayerState) => PlayerState,
): GtnState {
  const player = state.players[playerId];
  if (player === undefined) return state;
  return { ...state, players: { ...state.players, [playerId]: change(player) } };
}

function answered(state: GtnState, event: Extract<GtnEvent, { type: 'FeedbackGiven' }>): GtnState {
  const { receiveSeq, receivedAt, value, feedback } = event;
  const guess: Guess = { receiveSeq, receivedAt, value, feedback };
  return withPlayer(state, event.playerId, (p) => ({ ...p, guesses: [...p.guesses, guess] }));
}

// A new range for one player, or the shared window for all.
function halved(state: GtnState, event: Extract<GtnEvent, { type: 'RangeHalved' }>): GtnState {
  const window = event.range;
  if (window === null) return state;
  const narrow = (p: PlayerState): PlayerState => ({ ...p, range: window });
  if (event.playerId !== null) return withPlayer(state, event.playerId, narrow);
  const players = Object.fromEntries(
    Object.entries(state.players).map(([id, p]) => [id, narrow(p)]),
  );
  return { ...state, range: window, players };
}
