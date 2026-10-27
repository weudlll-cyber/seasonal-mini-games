/**
 * @file   packages/contracts/src/http/play.ts
 * @module contracts/http
 * @brief  The shapes of the match, round and season answers the player client reads.
 *
 * Responsibility: one description of what the server sends and the client renders (06 §3.1):
 *                 games, match summaries and details (with the match standings), the round view per viewer (platform part
 *                 plus the game's own view, unknown here), frames, Quick Test and seasons. The
 *                 server's routes return these types; the client never guesses a shape.
 * Depends on:     ./admin (settings document view), ./boards (match standings)
 * Used by:        ../index, apps/server (routes), apps/web
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1, §4.4
 */
import type { SettingsDocumentView } from './admin.js';
import type { MatchStandingView } from './boards.js';

export type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter';
export type TeamName = SeasonName;

export interface GameInfoView {
  readonly id: string;
  readonly name: string;
  readonly secretModes: readonly string[];
  readonly teams: boolean;
}

export interface MatchSummaryView {
  readonly code: string;
  readonly gameId: string;
  readonly title: string;
  readonly status: 'lobby' | 'open' | 'closed' | 'aborted';
  readonly visibility: 'public' | 'unlisted';
  readonly maxPlayers: number;
  readonly countsForLeaderboard: boolean;
  readonly createdAt: number;
}

export interface MatchDetailsView extends MatchSummaryView {
  readonly youHost: boolean;
  readonly youPlayer: boolean;
  readonly host: string | null;
  readonly players: readonly {
    readonly playerKey: string;
    readonly name: string;
    readonly team: TeamName | null;
  }[];
  readonly connected: readonly string[];
  readonly round: { readonly id: string; readonly status: string } | null;
  // The match's team standings in rank order; a team without points yet is absent.
  readonly teamStandings: readonly { readonly team: TeamName; readonly points: number }[];
  // The match's player standings in rank order (02 §9); a player without a round yet is absent.
  readonly standings: readonly MatchStandingView[];
  // The host's form defaults: the game's settings document (host-chosen keys and bounds).
  readonly nextRoundDefaults: SettingsDocumentView | null;
}

export interface RosterRowView {
  readonly playerKey: string;
  readonly team: TeamName | null;
  readonly guesses: number;
  readonly cooldownEndsAt: number;
  readonly place: number | null;
  readonly solved: boolean;
}

export interface PlayerResultView {
  readonly playerId: string;
  readonly place: number | null;
  readonly solved: boolean;
  readonly solveAt: number | null;
  readonly guesses: number;
  readonly team: TeamName | null;
  readonly points: number;
}

export interface RoundStateView {
  readonly roundId: string;
  readonly status: 'created' | 'countdown' | 'open' | 'ended' | 'aborted';
  readonly season: SeasonName;
  readonly secretMode: 'shared' | 'individual';
  // Season teams play this round (shared mode with teams on).
  readonly teamsOn: boolean;
  readonly specialOn: boolean;
  readonly halving: boolean;
  // Frost's delay in a winter round with its special on, else null.
  readonly frostDelayMs: number | null;
  readonly commitment: string | null;
  readonly opensAt: number | null;
  readonly endsAt: number | null;
  readonly endedAt: number | null;
  readonly cooldownMs: number;
  readonly endReason: 'solved' | 'allSolved' | 'timeUp' | 'host' | 'noPlayers' | 'game' | null;
  readonly abortReason: string | null;
  readonly winner: string | null;
  readonly margin: { readonly playerId: string; readonly ms: number } | null;
  readonly roster: readonly RosterRowView[];
  readonly seq: number;
  readonly role: 'player' | 'spectator' | 'result';
  // The game's own view for this viewer; only its screens read it.
  readonly game: unknown;
  readonly results?: readonly PlayerResultView[];
  readonly teams?: readonly {
    readonly team: TeamName;
    readonly members: number;
    readonly points: number;
    readonly won: boolean;
  }[];
  readonly seed?: string | null;
  readonly names: Readonly<Record<string, string>>;
}

// One committed event in a frame; `null` where the event is not for this room (06 §4.4).
export interface FrameEventView {
  readonly s: number;
  readonly at: number;
  readonly event: unknown;
}

export interface RoundFrameView {
  readonly roundId: string;
  readonly s?: number;
  readonly late?: boolean;
  readonly events: readonly FrameEventView[];
}

export interface QuickTestStartedView {
  readonly matchCode: string;
  readonly roundId: string;
  readonly season: SeasonName;
  readonly seedText: string;
}

export interface SeasonsCurrentView {
  readonly inSeason: {
    readonly season: SeasonName;
    readonly token: string;
    readonly since: number;
  } | null;
  readonly halvingToday: { readonly day: string; readonly tokens: readonly string[] } | null;
}
