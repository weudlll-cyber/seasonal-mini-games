/**
 * @file   packages/game-sdk/src/names.test.ts
 * @module game-sdk
 * @brief  The name order of O102: numbers in names by their value, case ignored.
 *
 * Responsibility: "bot-9" before "bot-10", "Anna" and "anna" equal, accents told apart.
 * Depends on:     vitest, ./names
 * Spec:           docs/spec/02-game-guess-the-number.md §9
 */
import { describe, expect, it } from 'vitest';

import { compareNames } from './names.js';

describe('compareNames (O102)', () => {
  it('orders the numbers in names by their value, case ignored', () => {
    expect(['bot-10', 'Bo', 'bot-9', 'anna', 'bot-1'].sort(compareNames)).toEqual([
      'anna',
      'Bo',
      'bot-1',
      'bot-9',
      'bot-10',
    ]);
    expect(compareNames('Anna', 'anna')).toBe(0);
    expect(compareNames('Zoë', 'Zoe')).not.toBe(0);
  });
});
