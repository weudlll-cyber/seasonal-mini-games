/**
 * @file   games/mind-games/web/formFields.test.ts
 * @module games/mind-games/web
 * @brief  The host form's delay and join time following the total, the rounds and pause held.
 *
 * Responsibility: 02e §3: while the delay follows the total, its field shows a quarter of the
 *                 total, and while the join time does, its field half the total, each rounded
 *                 down, off, with its own help line; with the box off it is the setting's own,
 *                 whatever the other box says (O96); from the
 *                 match's second round the rounds and the pause are off; other fields keep their
 *                 definition's.
 * Depends on:     vitest, ./formFields
 * Spec:           docs/spec/02e-game-mind-games.md §2, §3
 */
import { describe, expect, it } from 'vitest';

import { mindFieldState } from './formFields.js';

const values = {
  'mind.totalS': 61,
  'mind.delayAuto': true,
  'mind.delayS': 12,
  'mind.joinAuto': true,
  'mind.joinS': 45,
};

describe('Mind Games host form fields (02e §3)', () => {
  it('shows the join time as half the total while it follows the total', () => {
    expect(mindFieldState('mind.joinS', values, true)).toMatchObject({ value: 30, disabled: true });
    expect(mindFieldState('mind.joinS', { ...values, 'mind.joinAuto': false }, true)).toBeNull();
  });

  it('shows the delay as a quarter of the total while it follows the total (O96)', () => {
    expect(mindFieldState('mind.delayS', values, true)).toEqual({
      value: 15,
      disabled: true,
      help: 'Follows the total: a quarter of it. Turn "Delay follows the total" off to set it.',
    });
    expect(mindFieldState('mind.delayS', { ...values, 'mind.totalS': 120 }, true)).toMatchObject({
      value: 30,
    });
    expect(mindFieldState('mind.delayS', { ...values, 'mind.totalS': 40 }, true)).toMatchObject({
      value: 10,
    });
    // Off: the setting's own field and bounds; the join time still follows the total.
    const own = { ...values, 'mind.delayAuto': false };
    expect(mindFieldState('mind.delayS', own, true)).toBeNull();
    expect(mindFieldState('mind.joinS', own, true)).toMatchObject({ value: 30, disabled: true });
  });

  it('holds the rounds and the pause from the second round on', () => {
    expect(mindFieldState('mind.rounds', values, true)).toBeNull();
    expect(mindFieldState('mind.rounds', values, false)).toMatchObject({ disabled: true });
    expect(mindFieldState('mind.pauseS', values, false)).toMatchObject({ disabled: true });
    expect(mindFieldState('mind.totalS', values, false)).toBeNull();
  });

  it('words the countdown without a season, which the game does not show (O93)', () => {
    const help = mindFieldState('round.countdownS', values, true)?.help ?? '';
    expect(help).toBe('The intro screen with the round’s rule and times, before it opens.');
    expect(help).not.toMatch(/season|special/i);
  });
});
