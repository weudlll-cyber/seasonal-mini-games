/**
 * @file   packages/domain/src/round/phased.ts
 * @module domain/round
 * @brief  One action in a `phased` round, and a match player joining or leaving while it runs.
 *
 * Responsibility: the checks of 04 §4.8 rule 2 in their order, all at the receive time: the
 *                 round open (ROUND_NOT_OPEN, ROUND_OVER), an active match player
 *                 (NOT_IN_ROUND), play not over (PLAY_OVER), a player not yet in the round
 *                 inside the entry window (JOIN_CLOSED), then the game's `validate` and
 *                 `decide`. There is no cooldown, no timeout, no solve and no Frost: an
 *                 accepted action is logged with its receive time as its cooldown end, its
 *                 events go out as the game addressed them, and its reply carries nothing
 *                 (rule 4: no receive number). A player's first accepted action is preceded
 *                 by PlayerEntered. A rejection emits nothing.
 * Depends on:     ./builder, ./lifecycle (catch-up), ./types
 * Used by:        ./step
 * Spec:           docs/spec/04-software-architecture.md §4.8 rules 2–4
 */
import { fail, type Step } from './builder.js';
import { catchUp } from './lifecycle.js';
import type { Reply } from './types.js';

interface ActionCmd<A> {
  readonly playerId: string;
  readonly receivedAt: number;
  readonly action: A;
}

// The platform's checks 1–4 of rule 2; null when the action may go on to the game.
function refusal<S, A, E, Cfg, Sec>(
  step: Step<S, A, E, Cfg, Sec>,
  cmd: ActionCmd<A>,
): Reply | null {
  const s = step.state;
  if (s.status === 'created' || s.status === 'countdown') return fail('ROUND_NOT_OPEN');
  if (s.status !== 'open' || s.plan === undefined || s.opensAt === null) return fail('ROUND_OVER');
  const entry = s.roster[cmd.playerId];
  if (entry?.member !== true) return fail('NOT_IN_ROUND');
  const sinceOpen = cmd.receivedAt - s.opensAt;
  if (sinceOpen >= s.plan.actionsEndMs) return fail('PLAY_OVER');
  if (entry.enteredAt == null && sinceOpen >= s.plan.entryEndMs) return fail('JOIN_CLOSED');
  return null;
}

export function phasedAction<S, A, E, Cfg, Sec>(
  step: Step<S, A, E, Cfg, Sec>,
  cmd: ActionCmd<A>,
): Reply {
  catchUp(step, cmd.receivedAt);
  const refused = refusal(step, cmd);
  if (refused !== null) return refused;
  const s = step.state;
  if (s.game === null) throw new Error('an open round has a game state');
  const { module, secrets, rng } = step.deps;
  const code = module.validate(s.game, cmd.playerId, cmd.action);
  if (code !== null) return fail(code);
  const { playerId, receivedAt, action } = cmd;
  const receiveSeq = s.lastSeq + 1;
  // A phased game may have no secrets; it gets what its deriveSecrets gave (null for none).
  const ctx = { now: receivedAt, cooldownMs: 0, secrets: secrets as Sec, rng };
  const decision = module.decide(s.game, { playerId, receiveSeq, receivedAt, action }, ctx);
  if (!decision.ok) return fail(decision.code);
  if (s.roster[playerId]?.enteredAt == null) {
    step.emit({ type: 'PlayerEntered', playerId, at: receivedAt });
  }
  // No cooldown: the next action may follow at once (rule 4).
  step.emit({
    type: 'GuessAccepted',
    playerId,
    receiveSeq,
    receivedAt,
    action,
    cooldownEndsAt: receivedAt,
  });
  for (const e of decision.events) {
    step.emit({
      type: 'Game',
      audience: e.audience,
      feedback: false,
      deliverAt: null,
      event: e.event,
    });
  }
  return { ok: true };
}

// A match player joined, or left or was removed, while the phased round runs (rule 3).
export function memberChange<S, A, E, Cfg, Sec>(
  step: Step<S, A, E, Cfg, Sec>,
  cmd: { readonly at: number; readonly playerId: string; readonly active: boolean },
): Reply {
  catchUp(step, cmd.at);
  const s = step.state;
  if (s.plan === undefined || (s.status !== 'countdown' && s.status !== 'open')) {
    return fail('ROUND_STATE_INVALID');
  }
  if ((s.roster[cmd.playerId]?.member ?? false) === cmd.active) return { ok: true };
  step.emit({ type: 'MemberChanged', playerId: cmd.playerId, active: cmd.active, at: cmd.at });
  return { ok: true };
}
