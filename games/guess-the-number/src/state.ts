/**
 * @file   games/guess-the-number/src/state.ts
 * @module games/guess-the-number
 * @brief  Game state and events of a round, and how the game's own events change the state.
 *
 * Responsibility: on top of the guess engine's part (per player the accepted guesses with
 *                 their answers and closeness comments, O21; the comment lines used, T72), per
 *                 roster player the current range; the removed numbers; whether the range is
 *                 shown (O19); the hints of Spring Herald and the windows of halving (03 §2.1,
 *                 §2.3, §4). Nothing is narrowed from the answers (O17). No secret is ever part
 *                 of the state (05 §3). The engine folds its own events (`FeedbackGiven`,
 *                 `GuessFed`); `evolveGame` folds the hints, falls and halvings.
 * Depends on:     @smg/game-sdk (Range, RoundInput), @smg/guess-engine (state base, events),
 *                 ./closeness, ./feedback, ./settings
 * Used by:        ./module, ./rules, ./views, ./specials, ./leafFall, ./closestMiss
 * Spec:           docs/spec/02-game-guess-the-number.md §5, §6; docs/spec/04-software-architecture.md §4.7;
 *                 docs/spec/06-data-model-api-realtime.md §2.7
 */
import type { Range, RoundInput } from '@smg/game-sdk';
import {
  baseState,
  withPlayer,
  type CommentState,
  type Guess as EngineGuess,
  type GuessBase,
  type GuessEvent,
  type GuessPlayer,
} from '@smg/guess-engine';

import type { Thresholds } from './closeness.js';
import type { Feedback } from './feedback.js';
import type { GtnConfig } from './settings.js';

export type Guess = EngineGuess<number, Feedback>;

// Spring Herald's hint: the secret's last digit (O56), or which half of the range (03 §2.1).
export type Hint =
  | { readonly kind: 'lastDigit'; readonly digit: number }
  | { readonly kind: 'half'; readonly low: number; readonly high: number };

export interface PlayerState extends GuessPlayer<number, Feedback> {
  readonly range: Range;
  // Individual mode: the hint about the player's own number.
  readonly hint: Hint | null;
}

export interface GtnState extends GuessBase<number, Feedback> {
  // Off: no client learns the range while the round runs (O19, DECISIONS T52).
  readonly rangeVisible: boolean;
  // The engine's comment state, with the tiers' thresholds.
  readonly comments: CommentState & { readonly thresholds: Thresholds };
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

// The game's own events, beside the engine's answers and room lines.
export type GtnOwnEvent =
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

export type GtnEvent = GuessEvent<number, Feedback> | GtnOwnEvent;

export function createState(input: RoundInput<GtnConfig>): GtnState {
  const c = input.config;
  const base = baseState<number, Feedback>(input);
  const initial = { low: c.rangeLow, high: c.rangeHigh };
  const players = Object.fromEntries(
    input.roster.map((p) => [p.playerId, { range: initial, guesses: [], hint: null }]),
  );
  return {
    ...base,
    rangeVisible: c.rangeVisible,
    comments: { ...base.comments, thresholds: c.thresholds },
    specials: {
      // "Which half" names numbers of the range: a hidden range gets the last digit (T56).
      hintType: c.rangeVisible ? c.springHintType : 'lastDigit',
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

export function evolveGame(state: GtnState, event: GtnOwnEvent): GtnState {
  switch (event.type) {
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

// A new range for one player, or the shared window for all.
function halved(state: GtnState, event: Extract<GtnOwnEvent, { type: 'RangeHalved' }>): GtnState {
  const window = event.range;
  if (window === null) return state;
  const narrow = (p: PlayerState): PlayerState => ({ ...p, range: window });
  if (event.playerId !== null) return withPlayer(state, event.playerId, narrow);
  const players = Object.fromEntries(
    Object.entries(state.players).map(([id, p]) => [id, narrow(p)]),
  );
  return { ...state, range: window, players };
}
