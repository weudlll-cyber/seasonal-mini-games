/**
 * @file   packages/game-sdk/src/module.ts
 * @module game-sdk
 * @brief  The game-module contract: what a game gives the platform and what it gets back.
 *
 * Responsibility: the types of 04 §4 as built: round input, the ordered player action, the
 *                 step context, decisions with routed events and outcome signals, views and
 *                 their schemas. Secrets are their own value (`Sec`), derived from the round
 *                 randomness and never part of the state, so snapshots and views of state can
 *                 never hold one (05 §3). Checks a game owns run in `validate`, before the
 *                 platform's cooldown check (02 §5.1 order; DECISIONS T29).
 * Depends on:     zod (schemas), ./random, ./settings
 * Used by:        ./index, packages/domain (round engine), games/*
 * Spec:           docs/spec/04-software-architecture.md §4, docs/spec/02-game-guess-the-number.md §5.1
 */
import type { ZodType } from 'zod';

import type { RoundRng } from './random.js';
import type { SettingDef, SettingValue } from './settings.js';

export type SecretMode = 'shared' | 'individual';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface GameMeta {
  // URL- and DB-safe, never reused.
  readonly id: string;
  readonly name: string;
  readonly contractVersion: 1;
  readonly timing: 'cooldown';
  readonly secretModes: readonly SecretMode[];
  // Supports season teams (shared mode).
  readonly teams: boolean;
}

// The game's own keys of its settings document, and how frozen values become its config.
export interface GameSettings<Cfg> {
  readonly defs: readonly SettingDef[];
  readonly read: (values: Readonly<Record<string, SettingValue>>) => Cfg;
  // A rule across keys (e.g. a range at least 10 wide); null when the values fit.
  readonly problem: (cfg: Cfg) => string | null;
}

export interface RosterPlayer {
  readonly playerId: string;
  readonly team: string | null;
}

// What the platform hands a game when the roster is frozen (04 §4.1).
export interface RoundInput<Cfg> {
  readonly roundId: string;
  readonly roster: readonly RosterPlayer[];
  readonly secretMode: SecretMode;
  readonly season: Season;
  readonly halving: boolean;
  readonly config: Cfg;
}

// A validated, ordered player action, after every platform check (04 §4.1).
export interface PlayerAction<A> {
  readonly playerId: string;
  readonly receiveSeq: number;
  readonly receivedAt: number;
  readonly action: A;
}

export interface GameCtx<Sec> {
  // Server-clock milliseconds of this step.
  readonly now: number;
  // The cooldown in force for this step (Heatwave changes it).
  readonly cooldownMs: number;
  readonly secrets: Sec;
  readonly rng: RoundRng;
}

export type Audience = 'room' | 'host' | `player:${string}`;

export interface Emitted<E> {
  readonly event: E;
  readonly audience: Audience;
  // An answer to a guess: Frost holds it back (04 §4.4).
  readonly feedback?: boolean;
}

export type Signal =
  | { readonly type: 'Solved'; readonly playerId: string }
  | { readonly type: 'RoundShouldEnd'; readonly reason: string };

export type Decision<E> =
  | {
      readonly ok: true;
      readonly events: readonly Emitted<E>[];
      readonly signals: readonly Signal[];
    }
  | { readonly ok: false; readonly code: string };

// What views may show of answers: feedback of guesses received after `releasedBefore` is
// still held by Frost and must not appear (09 §6 "Frost early read").
export interface ViewCtx {
  readonly releasedBefore: number;
}

export interface GameViews<S, Sec> {
  readonly player: (state: S, playerId: string, ctx: ViewCtx) => unknown;
  readonly spectator: (state: S, ctx: ViewCtx) => unknown;
  // Only after the round has ended: the one view that shows secrets.
  readonly result: (state: S, secrets: Sec) => unknown;
}

// The specials a game implements (04 §4.4). One call is one firing; every random choice
// comes from `ctx.rng` under the special's label (04 §5.4). An empty list from `leafFall` or
// `halving` means the special has run its course in this round.
export interface SpecialHooks<S, E, Sec> {
  readonly springHerald: (state: S, ctx: GameCtx<Sec>) => readonly Emitted<E>[];
  readonly leafFall: (
    state: S,
    ctx: GameCtx<Sec>,
    fall: { readonly index: number; readonly count: number },
  ) => readonly Emitted<E>[];
  readonly halving: (state: S, ctx: GameCtx<Sec>, index: number) => readonly Emitted<E>[];
}

export interface GameModule<S, A, E, Cfg, Sec> {
  readonly meta: GameMeta;
  readonly settings: GameSettings<Cfg>;
  readonly actionSchema: ZodType<A>;
  readonly deriveSecrets: (input: RoundInput<Cfg>, rng: RoundRng) => Sec;
  readonly createRound: (input: RoundInput<Cfg>) => S;
  // The game's own acceptance checks; a rejection code, or null to go on.
  readonly validate: (state: S, playerId: string, action: A) => string | null;
  readonly decide: (state: S, act: PlayerAction<A>, ctx: GameCtx<Sec>) => Decision<E>;
  readonly evolve: (state: S, event: E) => S;
  readonly views: GameViews<S, Sec>;
  readonly viewSchemas: {
    readonly player: ZodType;
    readonly spectator: ZodType;
    readonly result: ZodType;
  };
  // A season whose special the game does not implement runs without it (04 §4.4).
  readonly specials?: Partial<SpecialHooks<S, E, Sec>>;
}

// What a game gives the platform's conformance suite (04 §4.5, 09 §2): a round input, secrets
// with marks that must appear in no view or event of a running round, and actions from
// integers (none of which may hit or neighbour a secret, so no answer reveals one).
export interface ConformanceKit<A, Cfg, Sec> {
  readonly input: (mode: SecretMode, playerIds: readonly string[]) => RoundInput<Cfg>;
  readonly sentinels: (input: RoundInput<Cfg>) => { secrets: Sec; marks: readonly string[] };
  readonly action: (n: number) => A;
}

// The next action of a development bot (Quick Test, 09 §5) from its own player view, or
// null when it has nothing to do; `pick(n)` is a uniform integer in [0, n).
export type DevBot<A> = (playerView: unknown, pick: (n: number) => number) => A | null;

// One registry line: a module, its conformance kit and its development bot.
export interface GameEntry<S, A, E, Cfg, Sec> {
  readonly module: GameModule<S, A, E, Cfg, Sec>;
  readonly conformance: ConformanceKit<A, Cfg, Sec>;
  readonly devBot: DevBot<A>;
}
