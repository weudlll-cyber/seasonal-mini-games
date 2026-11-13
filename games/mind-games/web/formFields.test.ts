/**
 * @file   games/mind-games/web/formFields.test.ts
 * @module games/mind-games/web
 * @brief  The host form's join time following the total, the rounds and pause held for the match.
 *
 * Responsibility: 02e §3: while the join time follows the total, its field shows half the total,
 *                 off, with its own help line; with the box off it is the setting's own; from the
 *                 match's second round the rounds and the pause are off; other fields keep their
 *                 definition's.
 * Depends on:     vitest, ./formFields
 * Spec:           docs/spec/02e-game-mind-games.md §2, §3
 */
import { describe, expect, it } from 'vitest';

import { mindFieldState } from './formFields.js';

const values = { 'mind.totalS': 61, 'mind.joinAuto': true, 'mind.joinS': 45 };

describe('Mind Games host form fields (02e §3)', () => {
  it('shows the join time as half the total while it follows the total', () => {
    expect(mindFieldState('mind.joinS', values, true)).toMatchObject({ value: 30, disabled: true });
    expect(mindFieldState('mind.joinS', { ...values, 'mind.joinAuto': false }, true)).toBeNull();
  });

  it('holds the rounds and the pause from the second round on', () => {
    expect(mindFieldState('mind.rounds', values, true)).toBeNull();
    expect(mindFieldState('mind.rounds', values, false)).toMatchObject({ disabled: true });
    expect(mindFieldState('mind.pauseS', values, false)).toMatchObject({ disabled: true });
    expect(mindFieldState('mind.totalS', values, false)).toBeNull();
  });
});
