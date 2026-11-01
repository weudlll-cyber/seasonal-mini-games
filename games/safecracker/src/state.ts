/**
 * @file   games/safecracker/src/state.ts
 * @module games/safecracker
 * @brief  Game state and events of a Safecracker round, and how the game's own events change it.
 *
 * Responsibility: on top of the guess engine's part (per player the accepted codes with their
 *                 answers and closeness comments), the code's length and digits in use, the
 *                 digits per Leaf Fall, the fallen digits (ascending), and Spring Herald's hint:
 *                 one shared, or each player's own (02b §7.1). Nothing is deduced from the
 *                 answers (O17). No secret is ever part of the state (05 §3). The engine folds
 *                 its own events; `evolveGame` folds the hints and the falls.
 * Depends on:     @smg/game-sdk (RoundInput), @smg/guess-engine (state base, events),
 *                 ./feedback, ./settings
 * Used by:        ./module, ./rules, ./views, ./specials, ./leafFall, ./fakes
 * Spec:           docs/spec/02b-game-safecracker.md §3, §5, §7; docs/spec/04-software-architecture.md §4.7
 */
import type { RoundInput } from '@smg/game-sdk';
import {
  baseState,
  withPlayer,
  type GuessBase,
  type GuessEvent,
  type GuessPlayer,
} from '@smg/guess-engine';

import type { Feedback } from './feedback.js';
import type { ScConfig } from './settings.js';

// Spring Herald's hint: the digit at a 0-based position of a code.
export interface Hint {
  readonly position: number;
  readonly digit: number;
}

export interface PlayerState extends GuessPlayer<string, Feedback> {
  // Individual mode: the hint about the player's own code.
  readonly hint: Hint | null;
}

export interface ScState extends GuessBase<string, Feedback> {
  readonly length: number;
  readonly digits: number;
  readonly perFall: number;
  // Digits no one may use any more (Leaf Fall), ascending.
  readonly fallen: readonly number[];
  // Shared mode: the one hint everyone got.
  readonly hint: Hint | null;
  readonly players: Readonly<Record<string, PlayerState>>;
}

export type ScOwnEvent =
  // `playerId` null with a hint: the shared hint, to everyone; null without one: the room's
  // line that every player got a hint of their own (individual mode).
  | { readonly type: 'HintGiven'; readonly playerId: string | null; readonly hint: Hint | null }
  | { readonly type: 'DigitsFallen'; readonly index: number; readonly digits: readonly number[] };

export type ScEvent = GuessEvent<string, Feedback> | ScOwnEvent;

export function createState(input: RoundInput<ScConfig>): ScState {
  const c = input.config;
  const base = baseState<string, Feedback>(input);
  return {
    ...base,
    length: c.codeLength,
    digits: c.codeDigits,
    perFall: c.digitsPerFall,
    fallen: [],
    hint: null,
    players: Object.fromEntries(input.roster.map((p) => [p.playerId, { guesses: [], hint: null }])),
  };
}

export function evolveGame(state: ScState, event: ScOwnEvent): ScState {
  if (event.type === 'DigitsFallen') {
    return { ...state, fallen: [...state.fallen, ...event.digits].sort((a, b) => a - b) };
  }
  const { hint } = event;
  if (event.playerId !== null) return withPlayer(state, event.playerId, (p) => ({ ...p, hint }));
  // The room's "everyone got a hint" line changes nothing.
  return hint === null ? state : { ...state, hint };
}

// The digits of a code as numbers.
export const digitsOf = (code: string): number[] => Array.from(code).map(Number);
