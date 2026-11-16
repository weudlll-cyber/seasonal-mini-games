/**
 * @file   packages/game-sdk/src/phased.test.ts
 * @module game-sdk
 * @brief  A phased round's plan check (04 §4.8 rule 1).
 *
 * Responsibility: `planIssue` takes a plan whose times are whole, not negative and in order
 *                 (joining ends by the end of actions, actions by the end, the end after the
 *                 opening; the delay any whole number), and words what is wrong otherwise.
 * Depends on:     vitest, ./phased
 * Spec:           docs/spec/04-software-architecture.md §4.8
 */
import { describe, expect, it } from 'vitest';

import { planIssue, type PhasePlan } from './phased.js';

const plan: PhasePlan = {
  entryEndMs: 60_000,
  actionsEndMs: 90_000,
  endMs: 120_000,
  viewDelayMs: 30_000,
};

describe('planIssue (04 §4.8 rule 1)', () => {
  it('takes plans in order, also with joining to the end of actions and no delay', () => {
    expect(planIssue(plan)).toBeNull();
    expect(planIssue({ ...plan, entryEndMs: 90_000, viewDelayMs: 0 })).toBeNull();
    expect(planIssue({ entryEndMs: 0, actionsEndMs: 0, endMs: 1, viewDelayMs: 0 })).toBeNull();
  });

  it('refuses times that are not whole or are negative', () => {
    for (const bad of [
      { entryEndMs: 1.5 },
      { actionsEndMs: -1 },
      { endMs: Number.NaN },
      { viewDelayMs: -5 },
    ]) {
      expect(planIssue({ ...plan, ...bad })).toBe(
        'The round plan needs whole, non-negative times.',
      );
    }
  });

  it('refuses times out of order, and a round that ends at its opening', () => {
    const order = 'Joining must end by the time actions end, and actions by the end of the round.';
    expect(planIssue({ ...plan, entryEndMs: 95_000 })).toBe(order);
    expect(planIssue({ ...plan, actionsEndMs: 130_000 })).toBe(order);
    expect(planIssue({ entryEndMs: 0, actionsEndMs: 0, endMs: 0, viewDelayMs: 0 })).toBe(order);
  });
});
