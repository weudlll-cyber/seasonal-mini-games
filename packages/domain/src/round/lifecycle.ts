/**
 * @file   packages/domain/src/round/lifecycle.ts
 * @module domain/round
 * @brief  Round lifecycle: create, countdown with the frozen roster, open, end, abort.
 *
 * Responsibility: the state machine of 02 §4. A step folds each event as it emits it, so a
 *                 later rule in the same step sees the effect of an earlier one. `catchUp`
 *                 opens a round whose `opensAt` has passed and ends one whose time is up
 *                 before any command runs, so a late scheduler firing never lets a guess in
 *                 early or late.
 * Depends on:     @smg/game-sdk (types), ./evolve, ./results, ./types
 * Used by:        ./guess, ./step, ../index
 * Spec:           docs/spec/02-game-guess-the-number.md §4, §8; docs/spec/04-software-architecture.md §5.1
 */
import type { PlatformRoundConfig, RosterPlayer, Season } from '@smg/game-sdk';

import { evolveRound, initialRound } from './evolve.js';
import { playerResults, teamResults } from './results.js';
import type { EndReason, Reply, RoundDeps, RoundEvent, RoundState, StepResult } from './types.js';

// Collects the events of one step, folding each into the state as it is emitted.
export class Step<S, A, E, Cfg, Sec> {
  private readonly emitted: RoundEvent<E, A, Cfg>[] = [];

  constructor(
    readonly deps: RoundDeps<S, A, E, Cfg, Sec>,
    public state: RoundState<S, Cfg>,
  ) {}

  emit(event: RoundEvent<E, A, Cfg>): void {
    this.emitted.push(event);
    this.state = evolveRound(this.deps.module, this.state, event);
  }

  done(reply: Reply): StepResult<S, A, E, Cfg> {
    return { state: this.state, events: this.emitted, reply };
  }
}

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

export const fail = (code: string, until?: number): Reply =>
  until === undefined ? { ok: false, code } : { ok: false, code, until };

export function catchUp<S, A, E, Cfg, Sec>(step: Step<S, A, E, Cfg, Sec>, at: number): void {
  const { status, opensAt, endsAt } = step.state;
  if (status === 'countdown' && opensAt !== null && at >= opensAt) {
    step.emit({ type: 'RoundOpened', at: opensAt });
  }
  if (step.state.status === 'open' && endsAt !== null && at >= endsAt) {
    endRound(step, endsAt, 'timeUp');
  }
}

export function endRound<S, A, E, Cfg, Sec>(
  step: Step<S, A, E, Cfg, Sec>,
  at: number,
  reason: EndReason,
): void {
  const s = step.state;
  step.emit({
    type: 'RoundEnded',
    at,
    reason,
    results: playerResults(s),
    teams: teamResults(s),
    seed: s.config.commitReveal ? step.deps.seed : null,
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
  const roster: RosterPlayer[] = [];
  for (const p of cmd.roster) {
    if (seen.has(p.playerId)) continue;
    seen.add(p.playerId);
    roster.push({ playerId: p.playerId, team: teams ? p.team : null });
  }
  if (roster.length < Math.max(1, cmd.minPlayers)) return fail('NOT_ENOUGH_PLAYERS');
  const opensAt = cmd.at + s.config.countdownMs;
  step.emit({
    type: 'CountdownStarted',
    roster,
    opensAt,
    endsAt: opensAt + s.config.maxDurationMs,
  });
  return { ok: true };
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
