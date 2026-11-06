/**
 * @file   packages/domain/src/round/lifecycle.ts
 * @module domain/round
 * @brief  Round lifecycle: create, countdown with the frozen roster, open, end, abort.
 *
 * Responsibility: the state machine of 02 §4. The countdown freezes the roster and puts
 *                 players given without a season team into the smallest team (in a match the
 *                 server has placed them already, 03 §5, T82). `catchUp`
 *                 opens a round whose `opensAt` has passed (Spring Herald with it), fires the
 *                 specials that are due and ends a round whose time is up, before any command
 *                 runs, so a late timer never lets a guess in early or late (T32); with the
 *                 specials it times out the players whose inactivity limit and its grace
 *                 have passed, in time order, which may end the round (O71, O72). `nextDue` names the next of
 *                 these times for the round actor's timer.
 * Depends on:     @smg/game-sdk (types), ./builder, ./evolve, ./inactivity, ./results, ./specials,
 *                 ./types
 * Used by:        ./guess, ./step, ../index
 * Spec:           docs/spec/02-game-guess-the-number.md §4, §5.3, §8; docs/spec/04-software-architecture.md §5.1
 */
import type { PlatformRoundConfig, RosterPlayer, RoundRng, Season } from '@smg/game-sdk';

import { fail, Step } from './builder.js';
import { initialRound } from './evolve.js';
import { heldEnd, leftEnd, nextTimeout } from './inactivity.js';
import { playerResults, teamResults } from './results.js';
import { fireDue, nextSpecialAt, springHerald } from './specials.js';
import type { EndReason, Reply, RoundEvent, RoundState } from './types.js';

export interface NewRound<Cfg> {
  readonly roundId: string;
  readonly config: PlatformRoundConfig;
  readonly gameConfig: Cfg;
  readonly season: Season;
  // sha256 of the round seed (hex) when the fairness proof is on (02 §10).
  readonly commitment: string | null;
}

export function createRound<S, A, E, Cfg>(
  round: NewRound<Cfg>,
): { state: RoundState<S, Cfg>; event: RoundEvent<E, A, Cfg> } {
  const event = { type: 'RoundCreated', ...round } as const;
  return { state: initialRound<S, A, E, Cfg>(event), event };
}

export function catchUp<S, A, E, Cfg, Sec>(step: Step<S, A, E, Cfg, Sec>, at: number): void {
  const { status, opensAt } = step.state;
  if (status === 'countdown' && opensAt !== null && at >= opensAt) {
    step.emit({ type: 'RoundOpened', at: opensAt });
    springHerald(step, opensAt);
  }
  // Specials and timeouts due before the end happen first, in time order (03 §1, O71).
  if (step.state.status === 'open') runDue(step, at);
  const { endsAt } = step.state;
  if (step.state.status === 'open' && endsAt !== null && at >= endsAt) {
    endRound(step, endsAt, 'timeUp');
  }
}

// Every special and every inactivity timeout due by `at`, in time order; at one instant the
// specials first. A timeout is stamped with its deadline plus the grace (O72), and the round
// ends there when it leaves nobody, or in individual mode only solvers (O71).
function runDue<S, A, E, Cfg, Sec>(step: Step<S, A, E, Cfg, Sec>, at: number): void {
  for (;;) {
    const out = nextTimeout(step.state);
    if (out === null || out.at > at) {
      fireDue(step, at);
      return;
    }
    fireDue(step, out.at);
    step.emit({ type: 'PlayerTimedOut', playerId: out.playerId, at: out.at });
    const end = leftEnd(step.state);
    if (end !== null) {
      endRound(step, out.at, end, end === 'allSolved' ? heldEnd(step.state, out.at) : null);
      return;
    }
  }
}

// The next time this round must run without any player action: the open, a special, a
// timeout or the end (the round actor's one timer, 04 §5.2).
export function nextDue<S, Cfg>(
  state: RoundState<S, Cfg>,
  module: Parameters<typeof nextSpecialAt>[1],
): number | null {
  if (state.status === 'countdown') return state.opensAt;
  if (state.status !== 'open') return null;
  const times = [nextSpecialAt(state, module), nextTimeout(state)?.at, state.endsAt];
  const due = times.filter((t): t is number => typeof t === 'number');
  return due.length === 0 ? null : Math.min(...due);
}

export function endRound<S, A, E, Cfg, Sec>(
  step: Step<S, A, E, Cfg, Sec>,
  at: number,
  reason: EndReason,
  deliverAt: number | null = null,
): void {
  const s = step.state;
  step.emit({
    type: 'RoundEnded',
    at,
    reason,
    results: playerResults(s),
    teams: teamResults(s),
    seed: s.config.commitReveal ? step.deps.seed : null,
    deliverAt,
  });
}

// Freezes the roster: each player once, in the given order; teams only where they play.
export function startCountdown<S, A, E, Cfg, Sec>(
  step: Step<S, A, E, Cfg, Sec>,
  cmd: { at: number; roster: readonly RosterPlayer[]; minPlayers: number },
): Reply {
  const s = step.state;
  if (s.status !== 'created') return fail('ROUND_STATE_INVALID');
  const teams = s.config.teamsOn && s.config.secretMode === 'shared';
  const seen = new Set<string>();
  const unique: RosterPlayer[] = [];
  for (const p of cmd.roster) {
    if (seen.has(p.playerId)) continue;
    seen.add(p.playerId);
    unique.push({ playerId: p.playerId, team: teams ? p.team : null });
  }
  if (unique.length < Math.max(1, cmd.minPlayers)) return fail('NOT_ENOUGH_PLAYERS');
  const roster = teams ? withTeams(unique, step.deps.rng) : unique;
  const opensAt = cmd.at + s.config.countdownMs;
  step.emit({
    type: 'CountdownStarted',
    roster,
    opensAt,
    endsAt: opensAt + s.config.maxDurationMs,
  });
  return { ok: true };
}

const TEAMS = ['spring', 'summer', 'autumn', 'winter'] as const;

// A roster player given without a season team joins the round's smallest team; ties are
// broken with the round seed (label teams/tiebreak, 04 §5.4). The server places such players
// in the match's smallest team before the round starts (03 §5, T82), so this is the engine's
// own fallback for rosters handed over without teams (T264).
function withTeams(roster: readonly RosterPlayer[], rng: RoundRng): RosterPlayer[] {
  const isTeam = (t: string | null): t is (typeof TEAMS)[number] => TEAMS.some((x) => x === t);
  const size = new Map<string, number>(TEAMS.map((t) => [t, 0]));
  for (const p of roster) if (isTeam(p.team)) size.set(p.team, (size.get(p.team) ?? 0) + 1);
  const draw = rng.child('teams', 'tiebreak');
  return roster.map((p) => {
    if (isTeam(p.team)) return p;
    const least = Math.min(...size.values());
    const smallest = TEAMS.filter((t) => size.get(t) === least);
    const team = smallest[draw.nextInt(smallest.length)] ?? 'spring';
    size.set(team, least + 1);
    return { ...p, team };
  });
}

export function hostEnd<S, A, E, Cfg, Sec>(
  step: Step<S, A, E, Cfg, Sec>,
  at: number,
  reason: 'host' | 'noPlayers',
): Reply {
  catchUp(step, at);
  const { status } = step.state;
  if (status !== 'countdown' && status !== 'open') return fail('ROUND_STATE_INVALID');
  endRound(step, at, reason);
  return { ok: true };
}

export function abortRound<S, A, E, Cfg, Sec>(
  step: Step<S, A, E, Cfg, Sec>,
  cmd: { at: number; reason: string; by: string },
): Reply {
  catchUp(step, cmd.at);
  const { status } = step.state;
  if (status === 'ended' || status === 'aborted') return fail('ROUND_STATE_INVALID');
  step.emit({ type: 'RoundAborted', at: cmd.at, reason: cmd.reason, by: cmd.by });
  return { ok: true };
}
