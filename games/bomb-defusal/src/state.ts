/**
 * @file   games/bomb-defusal/src/state.ts
 * @module games/bomb-defusal
 * @brief  Game state and own events of a round, and how the game's own events change the state.
 *
 * Responsibility: on top of the guess engine's part (per player the accepted sequences with
 *                 their answers and closeness comments), the round's wires, cuts and explosion
 *                 penalty; the wires Leaf Fall marked harmless (palette order) and whether its
 *                 falls are over; the Spring Herald hint (shared: one for everyone; individual:
 *                 each player's own). No secret is ever part of the state (05 §3). The engine
 *                 folds its own events; `evolveGame` folds the hints and the marks.
 * Depends on:     @smg/game-sdk (RoundInput), @smg/guess-engine (state base, events), ./settings,
 *                 ./wires
 * Used by:        ./module, ./rules, ./views, ./specials, ./leafFall, ./fakes
 * Spec:           docs/spec/02c-game-bomb-defusal.md §3, §8.1, §8.3; docs/spec/04-software-architecture.md §4.7
 */
import type { RoundInput } from '@smg/game-sdk';
import {
  baseState,
  withPlayer,
  type GuessBase,
  type GuessEvent,
  type GuessPlayer,
} from '@smg/guess-engine';

import type { BdConfig } from './settings.js';
import { inPaletteOrder, wiresOf, type Feedback, type Sequence, type Wire } from './wires.js';

export interface PlayerState extends GuessPlayer<Sequence, Feedback> {
  // Individual mode: the first wire of the player's own bomb (Spring Herald).
  readonly hint: Wire | null;
}

export interface BdState extends GuessBase<Sequence, Feedback> {
  readonly wires: readonly Wire[];
  readonly cuts: number;
  readonly penaltyMs: number;
  readonly wiresPerFall: number;
  // Marked harmless by Leaf Fall, in palette order.
  readonly harmless: readonly Wire[];
  // Leaf Fall found no candidate any more and said so once (02c §8.3).
  readonly fallsOver: boolean;
  // Shared mode: the one hint everyone got.
  readonly hint: Wire | null;
  readonly players: Readonly<Record<string, PlayerState>>;
}

export type BdOwnEvent =
  // `playerId` null: the shared hint, to everyone.
  | { readonly type: 'HintGiven'; readonly playerId: string | null; readonly wire: Wire }
  | { readonly type: 'WiresHarmless'; readonly index: number; readonly wires: readonly Wire[] }
  | { readonly type: 'HarmlessOver'; readonly index: number };

export type BdEvent = GuessEvent<Sequence, Feedback> | BdOwnEvent;

export function createState(input: RoundInput<BdConfig>): BdState {
  const c = input.config;
  const base = baseState<Sequence, Feedback>(input);
  const players = Object.fromEntries(
    input.roster.map((p) => [p.playerId, { guesses: [], hint: null }]),
  );
  return {
    ...base,
    wires: wiresOf(c.wires),
    cuts: c.cuts,
    penaltyMs: c.explosionPenaltyS * 1_000,
    wiresPerFall: c.wiresPerFall,
    harmless: [],
    fallsOver: false,
    hint: null,
    players,
  };
}

export function evolveGame(state: BdState, event: BdOwnEvent): BdState {
  switch (event.type) {
    case 'HintGiven':
      return event.playerId === null
        ? { ...state, hint: event.wire }
        : withPlayer(state, event.playerId, (p) => ({ ...p, hint: event.wire }));
    case 'WiresHarmless':
      return { ...state, harmless: inPaletteOrder([...state.harmless, ...event.wires]) };
    case 'HarmlessOver':
      return { ...state, fallsOver: true };
  }
}
