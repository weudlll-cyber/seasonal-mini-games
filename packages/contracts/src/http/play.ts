/**
 * @file   packages/contracts/src/http/play.ts
 * @module contracts/http
 * @brief  The shapes of the match, round and season answers the player client reads.
 *
 * Responsibility: one description of what the server sends and the client renders (06 §3.1):
 *                 games, match summaries and details (with the match standings and a closed
 *                 match's end), the round view per viewer (platform part
 *                 plus the game's own view, unknown here), frames, Quick Test and seasons. The
 *                 server's routes return these types; the client never guesses a shape. A
 *                 player key or id in any of them is the player's number in the match (`p3`),
 *                 never an account id (DECISIONS T104). A website member's Discord steps go
 *                 beside the name (`steps`, website mode only, O66; absent without any). The
 *                 roster carries each player's "timed out" (O71); the inactivity deadlines are
 *                 the viewer's own only (`ownInactivity`, O73), no other player's. A refused
 *                 setting names its field with the sentence for under it (O74).
 * Depends on:     ./admin (settings document view), ./boards (match standings), ./session (steps)
 * Used by:        ../index, apps/server (routes), apps/web
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1, §4.4
 */
import type { SettingsDocumentView } from './admin.js';
import type { MatchStandingView } from './boards.js';
import type { PlayerStepView } from './session.js';

export type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter';
export type TeamName = SeasonName;

export interface GameInfoView {
  readonly id: string;
  readonly name: string;
  readonly secretModes: readonly string[];
  readonly teams: boolean;
  // The timing class (04 §4.8): the forms leave out what a phased round does not have (T334).
  readonly timing: 'cooldown' | 'phased';
  // False for a game whose rounds show no season (the module's `meta.seasons`, O93).
  readonly seasons: boolean;
}

export interface MatchSummaryView {
  readonly code: string;
  readonly gameId: string;
  readonly title: string;
  readonly status: 'lobby' | 'open' | 'closed' | 'aborted';
  readonly visibility: 'public' | 'unlisted';
  readonly maxPlayers: number;
  readonly countsForLeaderboard: boolean;
  // The season teams play (O34): without, no view shows a team.
  readonly teamMatch: boolean;
  readonly createdAt: number;
}

// The end of a closed or aborted match (O27): the rounds played and how it ended. The
// players' totals and the teams come from the details' `standings` and `teamStandings`.
export interface MatchEndView {
  readonly roundsPlayed: number;
  readonly by: 'host' | 'system' | null;
  // `idle` for the idle close (O28), `complete` for a series after its last round (04 §4.8
  // rule 7), the host's reason for an abort, else null.
  readonly reason: string | null;
  // Idle close only: the minutes without a round before it closed.
  readonly idleMinutes: number | null;
  // A phased game's match: every ended round with what won in the game's words, or null
  // when nobody won (02e §9; DECISIONS T333). Absent for the guess games.
  readonly rounds?: readonly { readonly index: number; readonly words: string | null }[];
}

export interface MatchDetailsView extends MatchSummaryView {
  readonly youHost: boolean;
  readonly youPlayer: boolean;
  // The viewer's number in this match (`p3`), or null; every player key here is such a
  // number, never an account id (DECISIONS T104).
  readonly you: string | null;
  // The viewer's team is fixed: they played a round of this match (O26).
  readonly teamLocked: boolean;
  readonly host: string | null;
  readonly players: readonly {
    readonly playerKey: string;
    readonly name: string;
    readonly team: TeamName | null;
    // The member's Discord steps (website mode, O66); absent without any.
    readonly steps?: readonly PlayerStepView[];
  }[];
  readonly connected: readonly string[];
  readonly round: { readonly id: string; readonly status: string } | null;
  // The match's team standings in rank order; a team without points yet is absent.
  readonly teamStandings: readonly { readonly team: TeamName; readonly points: number }[];
  // The match's player standings in rank order (02 §9); a player without a round yet is absent.
  readonly standings: readonly MatchStandingView[];
  // The host's form defaults: the game's settings document (host-chosen keys and bounds).
  readonly nextRoundDefaults: SettingsDocumentView | null;
  // Once the match is closed or aborted, its summary; null before.
  readonly ended: MatchEndView | null;
  // A series of rounds (04 §4.8 rule 7): its number of rounds, those played, and the server
  // time its pause ends (null outside a pause); null for a match that is no series.
  // The viewer's own value for a phased game's match (its pre-picks, rule 8); null without one.
  readonly myPrefs?: unknown;
  readonly series?: {
    readonly rounds: number;
    readonly played: number;
    readonly nextAt: number | null;
  } | null;
}

// A player's inactivity deadlines (O71), absolute server times like `cooldownEndsAt`: the
// warning shows from `warnAt`, the player is out at `outAt` (the limit itself; the server's
// 2 s grace for a late guess is not part of it, O72). While a cooldown runs or an answer is
// held they lie further ahead (the clock starts once the next guess may be sent).
export interface InactivityView {
  readonly warnAt: number;
  readonly outAt: number;
}

export interface RosterRowView {
  readonly playerKey: string;
  readonly team: TeamName | null;
  readonly guesses: number;
  readonly cooldownEndsAt: number;
  readonly place: number | null;
  readonly solved: boolean;
  // Out of this round for inactivity (O71): shown as "timed out".
  readonly timedOut: boolean;
}

export interface PlayerResultView {
  readonly playerId: string;
  readonly place: number | null;
  readonly solved: boolean;
  readonly solveAt: number | null;
  readonly guesses: number;
  readonly team: TeamName | null;
  readonly points: number;
  // A phased round's own rule (04 §4.8 rule 6); absent for the guess games.
  readonly won?: boolean;
  // Listed as "timed out", without a place and without points (O71).
  readonly timedOut: boolean;
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
  // The round's inactivity limit and warning (O71), 0 = the limit off: the next round's form
  // starts from them (O75). Settings only; no player's deadline (O73).
  readonly inactivityLimitMs: number;
  readonly inactivityWarnMs: number;
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
  // Discord steps by player key, for the players that have any (website mode, O66); the
  // roster's and the results' names show them. Absent when no player has steps.
  readonly steps?: Readonly<Record<string, readonly PlayerStepView[]>>;
  // The viewer's number in the match, or null for a spectator who never joined (T104).
  readonly you?: string | null;
  // The viewer's own inactivity deadlines (O71), in the player view only: no viewer learns
  // another player's (O73). Null for spectators and results, and while the limit cannot
  // run out for the viewer: off, the round not open, solved or timed out.
  readonly ownInactivity: InactivityView | null;
  // A phased round's plan in milliseconds after `opensAt` (04 §4.8): the client shows its
  // phases, the server enforces them. Absent for the guess games. In a phased round `seq` is
  // its release sequence and the roster lists only players whose entry is one delay old.
  readonly plan?: {
    readonly entryEndMs: number;
    readonly actionsEndMs: number;
    readonly endMs: number;
    readonly viewDelayMs: number;
  };
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

// A refused setting (O74): 422 ROUND_SETTINGS_INVALID from the round setup and the Quick
// Test, SETTING_INVALID from the admin save. `detail` is the sentence to show under the field
// `field` names (from the setting's own check, @smg/game-sdk `settingIssue`); `field` is null
// for a rule that belongs to no one field (a game's own cross-key rule).
export interface SettingRefusalView {
  readonly code: 'ROUND_SETTINGS_INVALID' | 'SETTING_INVALID';
  readonly detail: string;
  readonly field: string | null;
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
