/**
 * @file   packages/domain/src/round/specials.ts
 * @module domain/round
 * @brief  The seasonal specials of a round: which apply, when they are due, and firing them.
 *
 * Responsibility: a round's season special applies when the round's special setting is on and
 *                 (for game specials) the game implements it; a halving round adds halving
 *                 (03 §2, §4). Spring Herald fires once at `opensAt`; Heatwave, Leaf Fall and
 *                 halving fire at `opensAt + k × interval` until the round ends or the special
 *                 has run its course, several due at one instant in the order halving, Leaf
 *                 Fall, Heatwave (03 §1 rule 6). Heatwave lowers the cooldown by its step to the
 *                 owner's 3 s floor (03 §2.2). Frost holds answers back by its delay (03 §2.4).
 *                 Everything is a step in the round's one queue, so a guess before a firing
 *                 sees the old state and one after it the new state, for everyone alike.
 * Depends on:     @smg/game-sdk (hooks, floor), ./builder, ./types
 * Used by:        ./lifecycle, ./guess, ../index
 * Spec:           docs/spec/03-seasonal-specials.md §1, §2, §4; docs/spec/04-software-architecture.md §4.4
 */
import { HEATWAVE_FLOOR_MS, type Emitted, type SpecialHooks } from '@smg/game-sdk';

import type { Step } from './builder.js';
import { INTERVAL_SPECIALS, type IntervalSpecial, type RoundState } from './types.js';

// Only which hooks exist matters for scheduling.
interface Module {
  readonly specials?: Partial<Record<keyof SpecialHooks<never, never, never>, unknown>> | undefined;
}

function on<S, Cfg>(state: RoundState<S, Cfg>, season: RoundState<S, Cfg>['season']): boolean {
  return state.config.specialOn && state.season === season;
}

// Frost's delay when this round is a winter round with its special on, else null.
export function frostDelay<S, Cfg>(state: RoundState<S, Cfg>): number | null {
  return on(state, 'winter') ? state.config.specials.frostDelayMs : null;
}

function applies<S, Cfg>(
  state: RoundState<S, Cfg>,
  module: Module,
  special: IntervalSpecial,
): boolean {
  if (state.specialsOver.includes(special)) return false;
  switch (special) {
    case 'halving':
      return state.config.halving && module.specials?.halving !== undefined;
    case 'leafFall':
      return on(state, 'autumn') && module.specials?.leafFall !== undefined;
    case 'heatwave':
      return on(state, 'summer') && state.cooldownMs > HEATWAVE_FLOOR_MS;
  }
}

function intervalOf<S, Cfg>(state: RoundState<S, Cfg>, special: IntervalSpecial): number {
  const t = state.config.specials;
  if (special === 'halving') return t.halvingIntervalMs;
  return special === 'leafFall' ? t.leafFall.intervalMs : t.heatwave.intervalMs;
}

// The next firing of an interval special before the round's end, or null.
function nextFiring<S, Cfg>(state: RoundState<S, Cfg>, module: Module) {
  if (state.status !== 'open' || state.opensAt === null || state.endsAt === null) return null;
  let next: { special: IntervalSpecial; index: number; at: number } | null = null;
  // Earlier in INTERVAL_SPECIALS wins a tie: halving, Leaf Fall, Heatwave.
  for (const special of INTERVAL_SPECIALS) {
    if (!applies(state, module, special)) continue;
    const index = state.specialIndex[special] + 1;
    const at = state.opensAt + index * intervalOf(state, special);
    if (at < state.endsAt && (next === null || at < next.at)) next = { special, index, at };
  }
  return next;
}

// The next time this round needs to run without any player action: open, a special, the end.
export function nextDue<S, Cfg>(state: RoundState<S, Cfg>, module: Module): number | null {
  if (state.status === 'countdown') return state.opensAt;
  if (state.status !== 'open') return null;
  return nextFiring(state, module)?.at ?? state.endsAt;
}

export function springHerald<S, A, E, Cfg, Sec>(step: Step<S, A, E, Cfg, Sec>, at: number): void {
  const hook = step.deps.module.specials?.springHerald;
  const { game } = step.state;
  if (!on(step.state, 'spring') || hook === undefined || game === null) return;
  emitGame(step, hook(game, ctxOf(step, at)));
  step.emit({
    type: 'SpecialFired',
    special: 'springHerald',
    index: 0,
    at,
    summary: null,
    last: true,
  });
}

// Fires, in order, every interval special due by `at`.
export function fireDue<S, A, E, Cfg, Sec>(step: Step<S, A, E, Cfg, Sec>, at: number): void {
  for (;;) {
    const next = nextFiring(step.state, step.deps.module);
    if (next === null || next.at > at) return;
    fire(step, next);
  }
}

function fire<S, A, E, Cfg, Sec>(
  step: Step<S, A, E, Cfg, Sec>,
  next: { special: IntervalSpecial; index: number; at: number },
): void {
  const { special, index, at } = next;
  if (special === 'heatwave') {
    const cooldownMs = Math.max(
      HEATWAVE_FLOOR_MS,
      step.state.cooldownMs - step.state.config.specials.heatwave.stepMs,
    );
    step.emit({ type: 'CooldownChanged', cooldownMs, at });
    const last = cooldownMs === HEATWAVE_FLOOR_MS;
    step.emit({ type: 'SpecialFired', special, index, at, summary: { cooldownMs }, last });
    return;
  }
  const hooks = step.deps.module.specials;
  const game = step.state.game;
  if (hooks === undefined || game === null) return;
  const ctx = ctxOf(step, at);
  const events =
    special === 'leafFall'
      ? (hooks.leafFall?.(game, ctx, { index, count: step.state.config.specials.leafFall.count }) ??
        [])
      : (hooks.halving?.(game, ctx, index) ?? []);
  emitGame(step, events);
  step.emit({ type: 'SpecialFired', special, index, at, summary: null, last: events.length === 0 });
}

function ctxOf<S, A, E, Cfg, Sec>(step: Step<S, A, E, Cfg, Sec>, at: number) {
  const { secrets, rng } = step.deps;
  if (secrets === null) throw new Error('a running round has secrets');
  return { now: at, cooldownMs: step.state.cooldownMs, secrets, rng };
}

// Special events reach everyone at once, never held by Frost (03 §2.1: a season has one special).
function emitGame<S, A, E, Cfg, Sec>(
  step: Step<S, A, E, Cfg, Sec>,
  events: readonly Emitted<E>[],
): void {
  for (const e of events) {
    step.emit({
      type: 'Game',
      audience: e.audience,
      feedback: e.feedback === true,
      deliverAt: null,
      event: e.event,
    });
  }
}
