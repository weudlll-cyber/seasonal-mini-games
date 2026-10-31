/**
 * @file   packages/game-sdk/src/web.ts
 * @module game-sdk
 * @brief  What a game's screens get from the player client, and the words it gives back.
 *
 * Responsibility: the props of a game's player, spectator and result panels and its text
 *                 hooks, as plain types (no UI library is named here; the registry's web half
 *                 binds them to components). The platform client draws everything common —
 *                 banner, cooldown ring, roster, the round's one list, results, proof — and
 *                 hands the game only its own view, a way to act, and the clock. The game
 *                 turns its view into the list's guess rows (`GuessRow`, O20) and words its
 *                 event rows (`FeedLine`); the client draws both, in one list.
 * Depends on:     ./module
 * Used by:        ./index, games/<game>/web, games/registry/web, apps/web
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02-game-guess-the-number.md §12
 */
import type { Season } from './module.js';

export interface ActReply {
  readonly ok: boolean;
  readonly code?: string;
  readonly until?: number;
  readonly cooldownEndsAt?: number;
}

export interface PlayerPanelProps {
  // The game's player view from the server; the panel only renders it.
  readonly view: unknown;
  readonly act: (action: unknown) => Promise<ActReply>;
  // False while the cooldown runs or the round is not open: the panel disables its input.
  readonly canAct: boolean;
  // Frost's delay when this round has Frost, for "answer arriving in 2 s".
  readonly frostDelayMs: number | null;
  // Server time, corrected by the measured clock offset (06 §4.1).
  readonly now: () => number;
  readonly season: Season;
}

export interface SpectatorPanelProps {
  readonly view: unknown;
  readonly names: Readonly<Record<string, string>>;
  readonly season: Season;
}

export interface ResultPanelProps {
  readonly view: unknown;
  readonly names: Readonly<Record<string, string>>;
  readonly viewerKey: string | null;
}

// An event row of the round's list: the line and the player it is about (for the colour
// dot), or null for the round as a whole.
export interface FeedLine {
  readonly text: string;
  readonly playerId: string | null;
}

// One guess in the round's list, as far as this viewer's view shows it (O20, O21).
export interface GuessRow {
  readonly key: string;
  // When the server received the guess: the list's order with the event rows.
  readonly at: number;
  // Null: the viewer's own guess.
  readonly playerId: string | null;
  // Null where the viewer may not see the number.
  readonly value: number | null;
  readonly feedback: 'higher' | 'lower' | 'correct' | null;
  // The closeness comment, exactly when the answer is shown; its tier for styling.
  readonly comment: string | null;
  readonly tier: string | null;
  // The viewer's own guess whose answer Frost still holds ("answer arriving in 2 s").
  readonly pending: boolean;
}

// Plain English for the game's own rejection codes and room events (02 §12); null when the
// text is not the game's. `guesses` turns the game's player or spectator view into rows.
export interface GameText {
  readonly code: (code: string) => string | null;
  readonly event: (event: unknown, names: Readonly<Record<string, string>>) => FeedLine | null;
  readonly guesses: (view: unknown) => readonly GuessRow[];
}
