/**
 * @file   packages/game-sdk/src/phased.ts
 * @module game-sdk
 * @brief  The timing class `phased`: a round's phase plan and the game's own result rule.
 *
 * Responsibility: what a `phased` game gives the platform beside the rest of its module
 *                 (04 §4.8): the plan of its round from the frozen config (until when a player
 *                 may enter, until when actions count, when it ends, and how late everyone
 *                 but the actor sees an action), and the result rows its own rule decides at
 *                 the end, in place of Solved signals, and whether its matches are a series of
 *                 rounds (how many, and the pause between them), read from a match's first
 *                 round, and optionally one small value per player per match (pre-picks), with
 *                 the action it makes for that player at a round's opening. `planIssue` is the
 *                 one check that a plan
 *                 is in order, used where a round is set up.
 * Depends on:     zod (types)
 * Used by:        ./module, ./index, packages/application (round settings), packages/domain
 * Spec:           docs/spec/04-software-architecture.md §4.8
 */

import type { ZodType } from 'zod';

// Milliseconds after the round's opening (opensAt).
export interface PhasePlan {
  // A player not yet in the round may enter until then.
  readonly entryEndMs: number;
  // No action is accepted at or after it.
  readonly actionsEndMs: number;
  // The round ends.
  readonly endMs: number;
  // Everyone but the actor sees an action this much later; 0 = live.
  readonly viewDelayMs: number;
}

// One player's result as the game's rule decides it; `actions` fills round_results.guesses.
export interface OutcomeRow {
  readonly playerId: string;
  readonly won: boolean;
  readonly points: number;
  readonly actions: number;
}

// A match that is a series of rounds (04 §4.8 rule 7): its number of rounds and the pause
// after each one, in which the result shows.
export interface Series {
  readonly rounds: number;
  readonly pauseMs: number;
}

// A player's value for the whole match (04 §4.8 rule 8): checked against `schema` (at most 2 KiB),
// it becomes the player's first action at each round's opening, or none.
export interface PrefsHooks<A, Cfg> {
  readonly schema: ZodType;
  // `prefs` passed the schema; the round's index in the match, from 1.
  readonly action: (prefs: unknown, roundIndex: number, cfg: Cfg) => A | null;
}

export interface PhasedHooks<S, A, Cfg> {
  readonly plan: (cfg: Cfg) => PhasePlan;
  // Read from the config of a match's first round; null: the host runs rounds one by one.
  readonly series: (cfg: Cfg) => Series | null;
  // Every player in the round, in the order the result lists them.
  readonly outcome: (state: S) => readonly OutcomeRow[];
  readonly prefs?: PrefsHooks<A, Cfg>;
}

// Null when the plan is in order: whole, non-negative times that follow each other.
export function planIssue(plan: PhasePlan): string | null {
  const times = [plan.entryEndMs, plan.actionsEndMs, plan.endMs, plan.viewDelayMs];
  if (!times.every((t) => Number.isInteger(t) && t >= 0)) {
    return 'The round plan needs whole, non-negative times.';
  }
  if (plan.entryEndMs > plan.actionsEndMs || plan.actionsEndMs > plan.endMs || plan.endMs === 0) {
    return 'Joining must end by the time actions end, and actions by the end of the round.';
  }
  return null;
}
