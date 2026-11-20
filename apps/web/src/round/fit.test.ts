// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/fit.test.ts
 * @module web/round
 * @brief  The screen's scale (O111): 1 when it fits, an even shrink, the floor, no loop.
 *
 * Responsibility: `nextScale` keeps the scale when the fixed parts fit, shrinks it in
 *                 proportion to the room, never above 1 and never below the floor; `settle`
 *                 starts from 1 every time, sets `--fit` and `data-fit-scale` on the root, fits a
 *                 screen at the largest scale that fits (within 1 %, also with a part that does
 *                 not shrink), stops at the floor when they cannot fit, and measures at most
 *                 nine times (no loop); a
 *                 screen with room is left at 1, as without the mechanism.
 * Depends on:     vitest, ./useFit
 * Spec:           docs/spec/04-software-architecture.md §4.6
 */
import { describe, expect, it } from 'vitest';

import { FIT_FLOOR, nextScale, settle } from './useFit.js';

describe('nextScale', () => {
  it('keeps the scale when the fixed parts fit', () => {
    expect(nextScale(1, 400, 400)).toBe(1);
    expect(nextScale(0.8, 300, 400)).toBe(0.8);
  });

  it('shrinks in proportion to the room, never above 1 or below the floor', () => {
    expect(nextScale(1, 500, 400)).toBeCloseTo(0.795, 3);
    expect(nextScale(0.9, 450, 400)).toBeCloseTo(0.795, 3);
    expect(nextScale(1, 4000, 400)).toBe(FIT_FLOOR);
  });
});

// A screen whose one fixed part is `natural` pixels high at scale 1 and `fixed` pixels that
// never shrink (a bar), in a box `room` pixels high; counts the measurements.
function screenOf(natural: number, fixed: number, room: number) {
  const box = document.createElement('div');
  const root = document.createElement('div');
  const part = document.createElement('div');
  part.dataset['fitFixed'] = '';
  root.append(part);
  box.append(root);
  document.body.append(box);
  let reads = 0;
  Object.defineProperty(box, 'clientHeight', { value: room });
  part.getBoundingClientRect = () => {
    reads += 1;
    const scale = parseFloat(root.style.getPropertyValue('--fit')) || 1;
    return new DOMRect(0, 0, 100, fixed + natural * scale);
  };
  return { box, root, reads: () => reads };
}

describe('settle', () => {
  it('leaves a screen with room at 1', () => {
    const s = screenOf(300, 0, 400);
    expect(settle(s.root, s.box)).toBe(1);
    expect(s.root.style.getPropertyValue('--fit')).toBe('1');
    expect(s.root.dataset['fitScale']).toBe('1');
    expect(s.reads()).toBe(1);
  });

  it('shrinks evenly until the fixed parts fit', () => {
    const s = screenOf(500, 0, 400);
    const scale = settle(s.root, s.box);
    // The largest that fits, within 1 %.
    expect(500 * scale).toBeLessThanOrEqual(400);
    expect(scale).toBeGreaterThan(0.79);
  });

  it('finds the largest fitting scale with a part that does not shrink, in few passes', () => {
    const s = screenOf(400, 100, 400);
    const scale = settle(s.root, s.box);
    expect(100 + 400 * scale).toBeLessThanOrEqual(400.5);
    // Not shrunk further than needed (the proportional guess alone would overshoot).
    expect(scale).toBeGreaterThan(0.74);
    expect(s.reads()).toBeLessThanOrEqual(9);
  });

  it('stops at the floor when the parts cannot fit, without a loop', () => {
    const s = screenOf(2_000, 0, 400);
    expect(settle(s.root, s.box)).toBe(FIT_FLOOR);
    expect(s.reads()).toBeLessThanOrEqual(9);
    // A second fitting starts from 1 again: the same result, not a smaller one.
    expect(settle(s.root, s.box)).toBe(FIT_FLOOR);
  });
});
