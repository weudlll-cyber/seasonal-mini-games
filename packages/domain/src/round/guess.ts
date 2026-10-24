/**
 * @file   packages/domain/src/round/guess.ts
 * @module domain/round
 * @brief  One player action: the acceptance checks in order, the cooldown, solves and winning.
 *
 * Responsibility: checks 1–7 of 02 §5.1 in that order (platform 1–3, the game's own 4–6 via
 *                 `validate`, the cooldown 7), then the game's decide. An accepted action
 *                 gets the next receive number and starts the cooldown from its receive time.
 *                 `Solved` signals become placings: in shared mode the first ends the round,
 *                 in individual mode solve order is place order (O4, O5). After a shared
 *                 win, a would-be correct guess inside the margin window sets the winning
 *                 margin (O13) and is still answered ROUND_OVER. A rejection emits nothing.
 * Depends on:     ./lifecycle, ./types
 * Used by:        ./step
 * Spec:           docs/spec/02-game-guess-the-number.md §5, §7, §8, §9;
 *                 docs/spec/04-software-architecture.md §4.2, §5.2, §5.5
 */
import type { Decision, PlayerAction } from '@smg/game-sdk';

import { catchUp, endRound, fail, type Step } from './lifecycle.js';
import type { Reply, RoundState } from './types.js';

interface GuessCmd<A> {
  readonly playerId: string;
  readonly receivedAt: number;
  readonly action: A;
}

type Accepted<E> = Extract<Decision<E>, { ok: true }>;
type Tried<A, E> =
  { ok: false; reply: Reply } | { ok: true; act: PlayerAction<A>; decision: Accepted<E> };

// Checks 4–7 and the game's decision, without changing anything.
function attempt<S, A, E, Cfg, Sec>(
  step: Step<S, A, E, Cfg, Sec>,
  state: RoundState<S, Cfg>,
  cmd: GuessCmd<A>,
): Tried<A, E> {
  const { module, secrets, rng } = step.deps;
  const entry = state.roster[cmd.playerId];
  if (state.game === null || secrets === null || entry === undefined) {
    throw new Error('a round with a roster has a game state and secrets');
  }
  const code = module.validate(state.game, cmd.playerId, cmd.action);
  if (code !== null) return { ok: false, reply: fail(code) };
  if (cmd.receivedAt < entry.cooldownEndsAt) {
    return { ok: false, reply: fail('COOLDOWN_ACTIVE', entry.cooldownEndsAt) };
  }
  const act = {
    playerId: cmd.playerId,
    receiveSeq: state.lastSeq + 1,
    receivedAt: cmd.receivedAt,
    action: cmd.action,
  };
  const ctx = { now: cmd.receivedAt, cooldownMs: state.cooldownMs, secrets, rng };
  const decision = module.decide(state.game, act, ctx);
  if (!decision.ok) return { ok: false, reply: fail(decision.code) };
  return { ok: true, act, decision };
}

export function guess<S, A, E, Cfg, Sec>(step: Step<S, A, E, Cfg, Sec>, cmd: GuessCmd<A>): Reply {
  catchUp(step, cmd.receivedAt);
  const s = step.state;
  if (s.status === 'created' || s.status === 'countdown') return fail('ROUND_NOT_OPEN');
  if (s.status !== 'open') {
    noteMargin(step, cmd);
    return fail('ROUND_OVER');
  }
  const entry = s.roster[cmd.playerId];
  if (entry === undefined) return fail('NOT_IN_ROUND');
  if (s.config.secretMode === 'individual' && entry.solvedSeq !== null) {
    return fail('ALREADY_SOLVED');
  }
  const tried = attempt(step, s, cmd);
  if (!tried.ok) return tried.reply;
  const receiveSeq = tried.act.receiveSeq;
  const cooldownEndsAt = cmd.receivedAt + s.cooldownMs;
  const { playerId, receivedAt, action } = cmd;
  step.emit({ type: 'GuessAccepted', playerId, receiveSeq, receivedAt, action, cooldownEndsAt });
  for (const e of tried.decision.events) {
    step.emit({
      type: 'Game',
      audience: e.audience,
      feedback: e.feedback === true,
      event: e.event,
    });
  }
  applySignals(step, tried.decision, receiveSeq, cmd.receivedAt);
  return { ok: true, receiveSeq, cooldownEndsAt };
}

function applySignals<S, A, E, Cfg, Sec>(
  step: Step<S, A, E, Cfg, Sec>,
  decision: Accepted<E>,
  receiveSeq: number,
  at: number,
): void {
  for (const signal of decision.signals) {
    const s = step.state;
    if (s.status !== 'open') return;
    if (signal.type === 'RoundShouldEnd') {
      endRound(step, at, 'game');
      continue;
    }
    const entry = s.roster[signal.playerId];
    if (entry === undefined || entry.solvedSeq !== null) continue;
    const shared = s.config.secretMode === 'shared';
    const place = shared ? 1 : s.solvedCount + 1;
    step.emit({ type: 'PlayerSolved', playerId: signal.playerId, receiveSeq, at, place });
    if (shared) endRound(step, at, 'solved');
    else if (step.state.solvedCount === Object.keys(s.roster).length)
      endRound(step, at, 'allSolved');
  }
}

// The first roster player after the winner whose guess would have been accepted and correct,
// within the margin window, sets the margin (02 §9).
function noteMargin<S, A, E, Cfg, Sec>(step: Step<S, A, E, Cfg, Sec>, cmd: GuessCmd<A>): void {
  const s = step.state;
  if (s.status !== 'ended' || s.winner === null || s.winnerAt === null || s.margin !== null) return;
  const ms = cmd.receivedAt - s.winnerAt;
  if (ms > s.config.marginWindowMs || cmd.playerId === s.winner) return;
  if (s.roster[cmd.playerId] === undefined) return;
  const tried = attempt(step, s, cmd);
  const solves = tried.ok && tried.decision.signals.some((x) => x.type === 'Solved');
  if (solves) step.emit({ type: 'MarginNoted', playerId: cmd.playerId, ms });
}
