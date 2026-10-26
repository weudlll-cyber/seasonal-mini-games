/**
 * @file   packages/game-sdk/src/web.ts
 * @module game-sdk
 * @brief  What a game's screens get from the player client, and the words it gives back.
 *
 * Responsibility: the props of a game's player, spectator and result panels and its text
 *                 hooks, as plain types (no UI library is named here; the registry's web half
 *                 binds them to components). The platform client draws everything common —
 *                 banner, cooldown ring, roster, results, proof — and hands the game only its
 *                 own view, a way to act, and the clock. The game words its live-list rows
 *                 (`FeedLine`); the client draws them.
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

// One row of the live list: the line, the player it is about (for the colour dot) and an
// answer the room may see, shown in colour after the line.
export interface FeedLine {
  readonly text: string;
  readonly playerId: string | null;
  readonly feedback: 'higher' | 'lower' | 'correct' | null;
}

// Plain English for the game's own rejection codes and room events (02 §12); null when the
// text is not the game's.
export interface GameText {
  readonly code: (code: string) => string | null;
  readonly event: (event: unknown, names: Readonly<Record<string, string>>) => FeedLine | null;
}
