/**
 * @file   packages/domain/src/round/step.ts
 * @module domain/round
 * @brief  One command on a round: the events it causes, the new state and the reply.
 *
 * Responsibility: the single entry the round actor calls per queue item (04 §5.2). Pure:
 *                 the same state, command and deps give the same result (invariant P1).
 * Depends on:     ./guess, ./lifecycle, ./types
 * Used by:        ../index, packages/application (round session)
 * Spec:           docs/spec/04-software-architecture.md §5.1, §5.2
 */
import { guess } from './guess.js';
import { abortRound, catchUp, hostEnd, startCountdown, Step } from './lifecycle.js';
import type { RoundCommand, RoundDeps, RoundState, StepResult } from './types.js';

export function stepRound<S, A, E, Cfg, Sec>(
  state: RoundState<S, Cfg>,
  cmd: RoundCommand<A>,
  deps: RoundDeps<S, A, E, Cfg, Sec>,
): StepResult<S, A, E, Cfg> {
  const step = new Step(deps, state);
  switch (cmd.type) {
    case 'startCountdown':
      return step.done(startCountdown(step, cmd));
    case 'open':
    case 'timeUp':
      // Scheduler firings: whatever is due at `at` happens; nothing else does.
      catchUp(step, cmd.at);
      return step.done({ ok: true });
    case 'guess':
      return step.done(guess(step, cmd));
    case 'end':
      return step.done(hostEnd(step, cmd.at, cmd.reason));
    case 'abort':
      return step.done(abortRound(step, cmd));
  }
}
