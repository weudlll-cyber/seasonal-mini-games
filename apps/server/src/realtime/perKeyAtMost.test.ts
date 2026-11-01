/**
 * @file   apps/server/src/realtime/perKeyAtMost.test.ts
 * @module server/realtime
 * @brief  At most one call a window per key; the calls in between come out as one at its end.
 *
 * Responsibility: a burst for one key gives the first call at once and one more at the end of
 *                 the window; a quiet window gives none; keys do not hold each other back.
 * Depends on:     vitest, ./perKeyAtMost
 * Spec:           docs/spec/06-data-model-api-realtime.md §4; docs/spec/09-testing-strategy.md §5
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { perKeyAtMost } from './perKeyAtMost.js';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('perKeyAtMost', () => {
  it('folds a burst into the first call and one at the end of the window', () => {
    const calls: string[] = [];
    const notify = perKeyAtMost(1_000, (key) => calls.push(key));
    for (let i = 0; i < 500; i += 1) notify('m1');
    expect(calls).toEqual(['m1']);
    vi.advanceTimersByTime(1_000);
    expect(calls).toEqual(['m1', 'm1']);
    vi.advanceTimersByTime(5_000);
    expect(calls).toEqual(['m1', 'm1']);
  });

  it('calls once for a single change and keeps keys apart', () => {
    const calls: string[] = [];
    const notify = perKeyAtMost(1_000, (key) => calls.push(key));
    notify('m1');
    notify('m2');
    vi.advanceTimersByTime(1_000);
    notify('m1');
    expect(calls).toEqual(['m1', 'm2', 'm1']);
  });
});
