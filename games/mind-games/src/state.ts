/**
 * @file   games/mind-games/src/state.ts
 * @module games/mind-games
 * @brief  The round's state, the player's action and the game's events.
 *
 * Responsibility: the state is the round's frozen config and every accepted choice in receive
 *                 order; a player's current choice is their last one. The action is a choice
 *                 with the state of the player's "Hide my switches" box (02e §5.1). The events
 *                 (06 §2.7): `ChoiceMade` to the chooser alone, the one the state folds;
 *                 `ChoiceFed` to the room, held for the delay by the platform, which says what
 *                 the feed shows of the choice and carries the counts and entrants right after
 *                 it, so no client counts (02e §6.1).
 * Depends on:     ./choices, ./settings (types)
 * Used by:        ./rules, ./views, ./module
 * Spec:           docs/spec/02e-game-mind-games.md §5, §6; docs/spec/06-data-model-api-realtime.md §2.7
 */
import type { Choice, Counts } from './choices.js';
import type { MindConfig } from './settings.js';

// The wire's guess value (06 §4.3): the choice's name and the box at that moment.
export interface MindChoice {
  readonly choice: string;
  readonly hide: boolean;
}

// The round action, as the `guess` intent hands it on: `{ value }` (06 §4.3).
export interface MindAction {
  readonly value: MindChoice;
}

// One accepted choice. `from` is null for a first choice; `hidden`: a switch the feed shows
// only in the counts (02e §6.3); `hide`: the chooser's box when they made it.
export interface Move {
  readonly playerKey: string;
  readonly choice: Choice;
  readonly from: Choice | null;
  readonly hidden: boolean;
  readonly hide: boolean;
  readonly at: number;
}

export interface MindState {
  readonly cfg: MindConfig;
  readonly moves: readonly Move[];
}

type ChoiceMade = { readonly type: 'ChoiceMade' } & Omit<Move, 'at'> & {
    readonly receivedAt: number;
  };

// What the room learns: a named first choice, a named switch, or for a hidden switch only that
// the counts changed.
export type ChoiceFed = {
  readonly type: 'ChoiceFed';
  readonly counts: Counts;
  readonly entrants: number;
} & (
  | { readonly kind: 'first'; readonly player: string; readonly choice: Choice }
  | {
      readonly kind: 'switch';
      readonly player: string;
      readonly from: Choice;
      readonly choice: Choice;
    }
  | { readonly kind: 'counts' }
);

export type MindEvent = ChoiceMade | ChoiceFed;

// Each player's current choice among the moves received before `before`, in entry order.
export function finalsBefore(moves: readonly Move[], before: number): Map<string, Choice> {
  const finals = new Map<string, Choice>();
  for (const m of moves) if (m.at < before) finals.set(m.playerKey, m.choice);
  return finals;
}
