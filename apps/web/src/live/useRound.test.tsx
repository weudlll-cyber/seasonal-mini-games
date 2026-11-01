// @vitest-environment jsdom
/**
 * @file   apps/web/src/live/useRound.test.tsx
 * @module web/live
 * @brief  The round hook keeps to the round it shows (T81).
 *
 * Responsibility: a reload of the last round still on its way when the next round has
 *                 loaded is dropped, so the old result never shows over the new round.
 * Depends on:     vitest, @testing-library/react, ./useRound (with ../shell/http and ./socket
 *                 replaced)
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1; docs/spec/09-testing-strategy.md §2
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useRound } from './useRound.js';

// Each request waits until the test answers it.
const waiting = new Map<string, ((v: unknown) => void)[]>();
vi.mock('../shell/http.js', () => ({
  api: (path: string) =>
    new Promise((resolve) => {
      waiting.set(path, [...(waiting.get(path) ?? []), resolve]);
    }),
}));
vi.mock('./socket.js', () => ({
  gameSocket: () => ({ on: () => undefined, off: () => undefined }),
}));

function answer(roundId: string, status: string): void {
  const path = `/rounds/${roundId}/state`;
  const next = waiting.get(path)?.shift();
  next?.({ roundId, status, frostDelayMs: null });
}

describe('the round hook', () => {
  it('drops an answer for the round it no longer shows', async () => {
    const { result, rerender } = renderHook(({ id }) => useRound(id), {
      initialProps: { id: 'r1' },
    });
    act(() => {
      answer('r1', 'ended');
    });
    await waitFor(() => {
      expect(result.current.state?.status).toBe('ended');
    });
    // The host's action reloads round 1, and the match moves on to round 2 meanwhile.
    void result.current.reload();
    rerender({ id: 'r2' });
    act(() => {
      answer('r2', 'countdown');
    });
    await waitFor(() => {
      expect(result.current.state?.roundId).toBe('r2');
    });
    await act(async () => {
      answer('r1', 'ended');
      await Promise.resolve();
    });
    expect(result.current.state).toMatchObject({ roundId: 'r2', status: 'countdown' });
  });
});
