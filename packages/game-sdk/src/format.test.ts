/**
 * @file   packages/game-sdk/src/format.test.ts
 * @module game-sdk
 * @brief  `formatNumber` groups thousands the en-US way, negative numbers too.
 *
 * Depends on:     vitest, ./format
 * Spec:           docs/spec/02-game-guess-the-number.md §12
 */
import { describe, expect, it } from 'vitest';

import { formatNumber } from './format.js';

describe('formatNumber', () => {
  it('groups thousands from 1,000 on and leaves smaller numbers alone', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1_000)).toBe('1,000');
    expect(formatNumber(1_000_000)).toBe('1,000,000');
    expect(formatNumber(-12_500)).toBe('-12,500');
    expect(formatNumber(-1_000_000_000)).toBe('-1,000,000,000');
  });
});
