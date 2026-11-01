/**
 * @file   games/seasonal-target/src/state.ts
 * @module games/seasonal-target
 * @brief  Game state and events of a Seasonal Target round, and how the game's own events fold.
 *
 * Responsibility: on top of the guess engine's part (per player the accepted guesses with
 *                 their answers and comments), the map and the feedback mode; per player the
 *                 current target area (their own in individual mode, the shared one copied to
 *                 everyone in shared mode) and their own Spring quarter; the shared area and
 *                 quarter; the fallen cells; where Leaf Fall and halving stop. No secret is
 *                 ever part of the state (05 §3), and nothing is narrowed from the answers
 *                 (O17). `evolveGame` folds the hints, falls and halvings.
 * Depends on:     @smg/game-sdk (RoundInput), @smg/guess-engine (state base, events),
 *                 ./geometry, ./settings
 * Used by:        ./module, ./rules, ./views, ./specials, ./leafFall
 * Spec:           docs/spec/02d-game-seasonal-target.md §4, §6, §8; docs/spec/04-software-architecture.md §4.7
 */
import type { RoundInput } from '@smg/game-sdk';
import {
  baseState,
  withPlayer,
  type GuessBase,
  type GuessEvent,
  type GuessPlayer,
} from '@smg/guess-engine';

import {
  cellKey,
  wholeMap,
  type Area,
  type Cell,
  type Feedback,
  type FeedbackMode,
  type MapSize,
} from './geometry.js';
import type { StConfig } from './settings.js';

export type QuarterName = 'north-west' | 'north-east' | 'south-west' | 'south-east';

// Spring Herald's hint: the map quarter that holds the target (02d §8.1).
export interface Quarter extends Area {
  readonly name: QuarterName;
}

export interface StPlayer extends GuessPlayer<Cell, Feedback> {
  // The player's current target area: the whole map until a halving.
  readonly area: Area;
  // Individual mode: the quarter of the player's own target.
  readonly hint: Quarter | null;
}

export interface StState extends GuessBase<Cell, Feedback> {
  readonly map: MapSize;
  readonly feedbackMode: FeedbackMode;
  readonly specials: { readonly minCellsLeft: number; readonly minCells: number };
  // Shared mode: the one target area. Individual mode: the whole map (each player has theirs).
  readonly area: Area;
  // The size every target area has now, the same for every player (03 §4).
  readonly areaSize: { readonly width: number; readonly height: number };
  // Cells no one may guess any more (Leaf Fall), row by row.
  readonly fallen: readonly Cell[];
  // Shared mode: the one quarter everyone got.
  readonly hint: Quarter | null;
  readonly players: Readonly<Record<string, StPlayer>>;
}

export type StOwnEvent =
  // `playerId` null: to the room, with the shared quarter, or (individual) none: "everyone
  // received a hint".
  | {
      readonly type: 'HintGiven';
      readonly playerId: string | null;
      readonly quarter: Quarter | null;
    }
  | { readonly type: 'CellsFell'; readonly index: number; readonly cells: readonly Cell[] }
  // `playerId` null with an area: the shared one; null without: the room's line that every
  // individual area is now `width` × `height`.
  | {
      readonly type: 'AreaHalved';
      readonly index: number;
      readonly playerId: string | null;
      readonly area: Area | null;
      readonly width: number;
      readonly height: number;
    };

export type StEvent = GuessEvent<Cell, Feedback> | StOwnEvent;

export function createState(input: RoundInput<StConfig>): StState {
  const c = input.config;
  const map = { width: c.width, height: c.height };
  const area = wholeMap(map);
  const base = baseState<Cell, Feedback>(input);
  const players = Object.fromEntries(
    input.roster.map((p) => [p.playerId, { guesses: [], area, hint: null }]),
  );
  return {
    ...base,
    map,
    feedbackMode: c.feedback,
    specials: { minCellsLeft: c.autumnMinCellsLeft, minCells: c.halvingMinCells },
    area,
    areaSize: { width: c.width, height: c.height },
    fallen: [],
    hint: null,
    players,
  };
}

export function evolveGame(state: StState, event: StOwnEvent): StState {
  switch (event.type) {
    case 'HintGiven':
      if (event.playerId === null) {
        return event.quarter === null ? state : { ...state, hint: event.quarter };
      }
      return withPlayer(state, event.playerId, (p) => ({ ...p, hint: event.quarter }));
    case 'CellsFell': {
      const fallen = [...state.fallen, ...event.cells].sort((a, b) => cellKey(a) - cellKey(b));
      return { ...state, fallen };
    }
    case 'AreaHalved':
      return halved(state, event);
  }
}

// One player's new area, or the shared one for all; the size line changes the size only.
function halved(state: StState, e: Extract<StOwnEvent, { type: 'AreaHalved' }>): StState {
  const sized = { ...state, areaSize: { width: e.width, height: e.height } };
  const area = e.area;
  if (area === null) return sized;
  if (e.playerId !== null) return withPlayer(sized, e.playerId, (p) => ({ ...p, area }));
  const players = Object.fromEntries(
    Object.entries(state.players).map(([id, p]) => [id, { ...p, area }]),
  );
  return { ...sized, area, players };
}
