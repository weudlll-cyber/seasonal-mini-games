/**
 * @file   packages/domain/src/round/types.ts
 * @module domain/round
 * @brief  Round state, commands, events and replies of the platform round engine.
 *
 * Responsibility: the shapes the round rules work on, serialisable as JSON so a snapshot is
 *                 the state itself. The state never holds a secret: secrets travel beside it
 *                 in RoundDeps (05 §3). Game state and game events are opaque here.
 * Depends on:     @smg/game-sdk (contract types, round config)
 * Used by:        ./*, ../index, packages/application (round session)
 * Spec:           docs/spec/02-game-guess-the-number.md §4–§9, docs/spec/04-software-architecture.md §5,
 *                 docs/spec/06-data-model-api-realtime.md §2.7
 */
import type {
  Audience,
  GameModule,
  PlatformRoundConfig,
  RosterPlayer,
  RoundRng,
  Season,
} from '@smg/game-sdk';

export type RoundStatus = 'created' | 'countdown' | 'open' | 'ended' | 'aborted';

// solved: the shared winner; allSolved: every individual player solved; game: the game's
// own end signal (RoundShouldEnd).
export type EndReason = 'solved' | 'allSolved' | 'timeUp' | 'host' | 'noPlayers' | 'game';

export interface RosterEntry {
  readonly team: string | null;
  readonly guesses: number;
  // Server time from which the next guess passes the cooldown check; 0 before the first.
  readonly cooldownEndsAt: number;
  readonly solvedSeq: number | null;
  readonly solvedAt: number | null;
  readonly place: number | null;
}

// The specials that fire at intervals after the open (03 §1 rule 2), in the order they run
// when due at the same instant (03 §1 rule 6).
export const INTERVAL_SPECIALS = ['halving', 'leafFall', 'heatwave'] as const;
export type IntervalSpecial = (typeof INTERVAL_SPECIALS)[number];
export type SpecialName = IntervalSpecial | 'springHerald';

export interface Margin {
  readonly playerId: string;
  readonly ms: number;
}

export interface RoundState<S, Cfg> {
  readonly roundId: string;
  readonly config: PlatformRoundConfig;
  readonly gameConfig: Cfg;
  readonly season: Season;
  readonly commitment: string | null;
  readonly status: RoundStatus;
  readonly opensAt: number | null;
  readonly endsAt: number | null;
  readonly endedAt: number | null;
  // In roster order (the order players were connected when the countdown started).
  readonly roster: Readonly<Record<string, RosterEntry>>;
  readonly lastSeq: number;
  // The cooldown in force now; only Heatwave changes it.
  readonly cooldownMs: number;
  readonly solvedCount: number;
  readonly winner: string | null;
  readonly winnerAt: number | null;
  readonly endReason: EndReason | null;
  readonly abortReason: string | null;
  readonly margin: Margin | null;
  // How often each interval special has fired, and which have run their course.
  readonly specialIndex: Readonly<Record<IntervalSpecial, number>>;
  readonly specialsOver: readonly IntervalSpecial[];
  // Created when the roster is frozen; null before the countdown.
  readonly game: S | null;
}

export interface PlayerResult {
  readonly playerId: string;
  readonly place: number | null;
  readonly solved: boolean;
  readonly solveSeq: number | null;
  readonly solveAt: number | null;
  readonly guesses: number;
  readonly team: string | null;
  readonly points: number;
}

export interface TeamResult {
  readonly team: string;
  readonly members: number;
  readonly points: number;
  readonly won: boolean;
}

export type RoundEvent<E, A, Cfg> =
  | {
      readonly type: 'RoundCreated';
      readonly roundId: string;
      readonly config: PlatformRoundConfig;
      readonly gameConfig: Cfg;
      readonly season: Season;
      readonly commitment: string | null;
    }
  | {
      readonly type: 'CountdownStarted';
      readonly roster: readonly RosterPlayer[];
      readonly opensAt: number;
      readonly endsAt: number;
    }
  | { readonly type: 'RoundOpened'; readonly at: number }
  | {
      readonly type: 'GuessAccepted';
      readonly playerId: string;
      readonly receiveSeq: number;
      readonly receivedAt: number;
      readonly action: A;
      readonly cooldownEndsAt: number;
    }
  | {
      readonly type: 'Game';
      readonly audience: Audience;
      readonly feedback: boolean;
      // Frost: the event reaches its audience only at this time (03 §2.4); null = at once.
      readonly deliverAt: number | null;
      readonly event: E;
    }
  | {
      readonly type: 'SpecialFired';
      readonly special: SpecialName;
      readonly index: number;
      readonly at: number;
      readonly summary: unknown;
      // The special has run its course (nothing more falls, the range is small enough).
      readonly last: boolean;
    }
  | { readonly type: 'CooldownChanged'; readonly cooldownMs: number; readonly at: number }
  | {
      readonly type: 'PlayerSolved';
      readonly playerId: string;
      readonly receiveSeq: number;
      readonly at: number;
      readonly place: number;
      readonly deliverAt: number | null;
    }
  | {
      readonly type: 'RoundEnded';
      readonly at: number;
      readonly reason: EndReason;
      readonly results: readonly PlayerResult[];
      readonly teams: readonly TeamResult[];
      // The round seed (hex) when the fairness proof is on.
      readonly seed: string | null;
      // Frost: a win is announced at the winning guess's receive time plus the delay.
      readonly deliverAt: number | null;
    }
  | {
      readonly type: 'RoundAborted';
      readonly at: number;
      readonly reason: string;
      readonly by: string;
    }
  | { readonly type: 'MarginNoted'; readonly playerId: string; readonly ms: number }
  // Frost: every held event up to this log seq has reached its audience (06 §2.7). Written by
  // the round actor, which numbers the log; it changes no state.
  | { readonly type: 'HeldDelivered'; readonly upTo: number; readonly at: number };

export type RoundCommand<A> =
  | {
      readonly type: 'startCountdown';
      readonly at: number;
      readonly roster: readonly RosterPlayer[];
      readonly minPlayers: number;
    }
  | { readonly type: 'open'; readonly at: number }
  // Whatever is due by `at` happens (a special, the open, the end); nothing else.
  | { readonly type: 'tick'; readonly at: number }
  | {
      readonly type: 'guess';
      readonly playerId: string;
      readonly receivedAt: number;
      readonly action: A;
    }
  | { readonly type: 'timeUp'; readonly at: number }
  | { readonly type: 'end'; readonly at: number; readonly reason: 'host' | 'noPlayers' }
  | { readonly type: 'abort'; readonly at: number; readonly reason: string; readonly by: string };

// Platform rejection codes (06 §4.3), plus lifecycle ones for host and scheduler commands.
export type RoundCode =
  | 'ROUND_NOT_OPEN'
  | 'ROUND_OVER'
  | 'NOT_IN_ROUND'
  | 'ALREADY_SOLVED'
  | 'COOLDOWN_ACTIVE'
  | 'NOT_ENOUGH_PLAYERS'
  | 'ROUND_STATE_INVALID';

export type Reply =
  | { readonly ok: true; readonly receiveSeq?: number; readonly cooldownEndsAt?: number }
  // `code` is a RoundCode or one of the game's own codes; `until` comes with COOLDOWN_ACTIVE.
  | { readonly ok: false; readonly code: string; readonly until?: number };

// What a step needs beside the state: the module, the round's secrets and randomness, and
// the seed to reveal at the end. Secrets are null before the roster is frozen.
export interface RoundDeps<S, A, E, Cfg, Sec> {
  readonly module: GameModule<S, A, E, Cfg, Sec>;
  readonly secrets: Sec | null;
  readonly rng: RoundRng;
  readonly seed: string | null;
}

export interface StepResult<S, A, E, Cfg> {
  readonly state: RoundState<S, Cfg>;
  readonly events: readonly RoundEvent<E, A, Cfg>[];
  readonly reply: Reply;
}
