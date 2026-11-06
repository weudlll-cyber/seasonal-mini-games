/**
 * @file   packages/domain/src/round/inactivity.ts
 * @module domain/round
 * @brief  The inactivity limit of a round (O71): each player's clock, deadlines and who is left.
 *
 * Responsibility: a roster player's clock runs only while they may guess: from the open,
 *                 and after each accepted guess from the later of its cooldown end (a Bomb
 *                 penalty included, T120) and the time Frost delivers its answer, so no wait
 *                 the round imposes counts against them (DECISIONS T267). The warning and the
 *                 limit are measured from that time; the earliest limit before the round's
 *                 end is the next timeout, a tie going to roster order. Who is left: a timed-
 *                 out player no longer blocks the end, and a round with nobody left ends.
 *                 Pure: times come from the state, so a replay or a late timer gives the same
 *                 deadlines and the same log.
 * Depends on:     ./specials (Frost's delay), ./types
 * Used by:        ./evolve, ./guess, ./lifecycle, ../index, apps/server (views)
 * Spec:           docs/spec/02-game-guess-the-number.md §5.3, §8; docs/spec/04-software-architecture.md §5.1
 */
import { frostDelay } from './specials.js';
import type { EndReason, RosterEntry, RoundState } from './types.js';

export interface InactivityDeadline {
  // Server times: the warning shows from `warnAt`, the player is out at `outAt`.
  readonly warnAt: number;
  readonly outAt: number;
}

// When the clock starts again after a guess received at `receivedAt`: once its cooldown is
// over and, under Frost, once its answer has arrived.
export function readyAfter<S, Cfg>(
  state: RoundState<S, Cfg>,
  receivedAt: number,
  cooldownEndsAt: number,
): number {
  const delay = frostDelay(state);
  return delay === null ? cooldownEndsAt : Math.max(cooldownEndsAt, receivedAt + delay);
}

// The player's deadlines while their clock can still run out in this round, else null
// (the limit off, the round not open, the player solved or out already).
export function inactivityDeadline<S, Cfg>(
  state: RoundState<S, Cfg>,
  entry: RosterEntry,
): InactivityDeadline | null {
  const { inactivityLimitMs, inactivityWarnMs } = state.config;
  // Written as "not above 0" so a round frozen before O71, without the key, has it off.
  if (!(inactivityLimitMs > 0) || state.status !== 'open') return null;
  if (entry.timedOut || entry.solvedSeq !== null) return null;
  return { warnAt: entry.readyAt + inactivityWarnMs, outAt: entry.readyAt + inactivityLimitMs };
}

// The next player to time out before the round's end, or null.
export function nextTimeout<S, Cfg>(
  state: RoundState<S, Cfg>,
): { readonly playerId: string; readonly at: number } | null {
  const endsAt = state.endsAt ?? Infinity;
  let next: { playerId: string; at: number } | null = null;
  // Roster order: the earlier entry keeps a tie.
  for (const [playerId, entry] of Object.entries(state.roster)) {
    const at = inactivityDeadline(state, entry)?.outAt;
    if (at !== undefined && at < endsAt && (next === null || at < next.at)) next = { playerId, at };
  }
  return next;
}

// The end the roster calls for now: nobody left (every player timed out), or in individual
// mode every player still in the round solved; null while someone still plays.
export function leftEnd<S, Cfg>(state: RoundState<S, Cfg>): EndReason | null {
  const left = Object.values(state.roster).filter((e) => !e.timedOut);
  if (left.length === 0) return 'noPlayers';
  const individual = state.config.secretMode === 'individual';
  return individual && left.every((e) => e.solvedSeq !== null) ? 'allSolved' : null;
}

// Under Frost an end by solves waits for the last solve's announcement (03 §2.4): a timeout
// that leaves only solvers ends the round at its own time, announced no earlier than that.
export function heldEnd<S, Cfg>(state: RoundState<S, Cfg>, at: number): number | null {
  const delay = frostDelay(state);
  if (delay === null) return null;
  const solves = Object.values(state.roster).map((e) => e.solvedAt ?? -Infinity);
  const shown = Math.max(...solves) + delay;
  return shown > at ? shown : null;
}
