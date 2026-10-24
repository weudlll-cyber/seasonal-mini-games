/**
 * @file   packages/domain/src/round/builder.ts
 * @module domain/round
 * @brief  One step's event collector, and the rejection reply.
 *
 * Responsibility: a step folds each event into the state as it emits it, so a later rule in
 *                 the same step sees the effect of an earlier one (a special before a guess,
 *                 a solve before the end); the collected events and the reply are its result.
 * Depends on:     ./evolve, ./types
 * Used by:        ./lifecycle, ./specials, ./guess, ./step
 * Spec:           docs/spec/04-software-architecture.md §5.1
 */
import { evolveRound } from './evolve.js';
import type { Reply, RoundDeps, RoundEvent, RoundState, StepResult } from './types.js';

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

export const fail = (code: string, until?: number): Reply =>
  until === undefined ? { ok: false, code } : { ok: false, code, until };
