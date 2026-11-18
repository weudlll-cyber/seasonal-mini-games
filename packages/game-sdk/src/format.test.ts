/**
 * @file   packages/game-sdk/src/format.test.ts
 * @module game-sdk
 * @brief  `formatNumber` groups thousands the en-US way, negative numbers too; `clockText`
 *         writes a span as "9:30", whole seconds down (O107).
 *
 * Depends on:     vitest, ./format
 * Spec:           docs/spec/02-game-guess-the-number.md §12
 */
import { describe, expect, it } from 'vitest';

import { clockText, formatNumber } from './format.js';

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

describe('clockText', () => {
  it('writes minutes and seconds, whole seconds down', () => {
    expect(clockText(0)).toBe('0:00');
    expect(clockText(4_900)).toBe('0:04');
    expect(clockText(59_999)).toBe('0:59');
    expect(clockText(570_400)).toBe('9:30');
  });
});
