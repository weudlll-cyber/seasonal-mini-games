/**
 * @file   packages/game-sdk/src/range.test.ts
 * @module game-sdk
 * @brief  Range arithmetic: size, membership of whole numbers, intersection.
 *
 * Responsibility: the intersection is the common part of both ranges or null, and a value
 *                 is inside only when it is a whole number between both ends (property test).
 * Depends on:     vitest, fast-check, ./range
 * Spec:           docs/spec/09-testing-strategy.md §2
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { inRange, intersect, rangeSize, type Range } from './range.js';

const range = fc
  .tuple(fc.integer({ min: -50, max: 50 }), fc.integer({ min: 0, max: 50 }))
  .map(([low, width]): Range => ({ low, high: low + width }));

describe('ranges', () => {
  it('counts both ends and accepts only whole numbers inside', () => {
    expect(rangeSize({ low: 1, high: 1_000 })).toBe(1_000);
    expect(inRange({ low: 1, high: 10 }, 10)).toBe(true);
    expect(inRange({ low: 1, high: 10 }, 0)).toBe(false);
    expect(inRange({ low: 1, high: 10 }, 2.5)).toBe(false);
  });

  it('intersects to exactly the values both ranges hold', () => {
    fc.assert(
      fc.property(range, range, fc.integer({ min: -60, max: 110 }), (a, b, v) => {
        const both = intersect(a, b);
        const inBoth = inRange(a, v) && inRange(b, v);
        expect(both === null ? false : inRange(both, v)).toBe(inBoth);
      }),
    );
  });
});
