// @vitest-environment jsdom
/**
 * @file   apps/web/src/live/useRoundFeed.test.tsx
 * @module web/live
 * @brief  The list and the panels show the same moment (T124).
 *
 * Responsibility: an event of a frame waits for the loaded state that holds it, so a Leaf
 *                 Fall row never stands beside a panel that does not show its numbers yet
 *                 (measured: they disagreed for 250–310 ms after each event); a state answer
 *                 older than the one shown, two reloads crossing, is dropped.
 * Depends on:     vitest, @testing-library/react, ./useRound (with ../shell/http and ./socket
 *                 replaced)
 * Spec:           docs/spec/06-data-model-api-realtime.md §4.4; docs/spec/09-testing-strategy.md §2
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useRound } from './useRound.js';

// Each request waits until the test answers it; the socket's handlers are kept to call.
const waiting: ((v: unknown) => void)[] = [];
const handlers = new Map<string, (arg: unknown) => void>();
vi.mock('../shell/http.js', () => ({
  api: () =>
    new Promise((resolve) => {
      waiting.push(resolve);
    }),
}));
vi.mock('./socket.js', () => ({
  gameSocket: () => ({
    on: (name: string, f: (arg: unknown) => void) => handlers.set(name, f),
    off: () => undefined,
  }),
}));

const state = (seq: number) => ({ roundId: 'r1', status: 'open', frostDelayMs: null, seq });
const answerNext = (seq: number) => waiting.shift()?.(state(seq));

afterEach(() => {
  waiting.length = 0;
  handlers.clear();
  vi.useRealTimers();
});

describe('the round hook keeps the list and the panels together', () => {
  it('shows an event only once the state holding it has loaded', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useRound('r1'));
    await act(async () => {
      answerNext(4);
      await Promise.resolve();
    });
    expect(result.current.state?.seq).toBe(4);
    act(() => {
      handlers.get('events')?.({
        roundId: 'r1',
        s: 5,
        events: [{ s: 5, at: 1_000, event: { type: 'Game', event: { type: 'NumbersRemoved' } } }],
      });
    });
    // The frame is in, its state not yet: the list does not run ahead of the panels.
    expect(result.current.feed).toEqual([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await act(async () => {
      answerNext(5);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.feed.map((i) => i.s)).toEqual([5]);
    });
    expect(result.current.state?.seq).toBe(5);
  });
});

describe('the round hook leaves the countdown by itself', () => {
  it('loads the state again after the opening time, with no frame of it (T127)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useRound('r1'));
    const opensAt = Date.now() + 2_000;
    await act(async () => {
      waiting.shift()?.({ ...state(2), status: 'countdown', opensAt });
      await Promise.resolve();
    });
    expect(waiting).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_800);
    });
    expect(waiting.length).toBeGreaterThan(0);
    await act(async () => {
      answerNext(6);
      await Promise.resolve();
    });
    expect(result.current.state?.status).toBe('open');
  });
});

describe('the round hook keeps the newest state', () => {
  it('drops a state answer older than the one shown', async () => {
    const { result } = renderHook(() => useRound('r1'));
    void result.current.reload();
    // Two requests on their way; the newer answer comes first.
    await act(async () => {
      waiting.pop()?.(state(9));
      await Promise.resolve();
    });
    await act(async () => {
      answerNext(7);
      await Promise.resolve();
    });
    expect(result.current.state?.seq).toBe(9);
  });
});
