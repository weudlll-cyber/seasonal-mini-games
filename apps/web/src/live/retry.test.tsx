// @vitest-environment jsdom
/**
 * @file   apps/web/src/live/retry.test.tsx
 * @module web/live
 * @brief  A refused load or watch is tried again a second later (T185).
 *
 * Responsibility: the round's state refused with 429 (the session's API budget spent) right
 *                 after the opening is loaded again a second later, so the intro leaves
 *                 "Opens in 0 s"; a final answer (404) is not tried again; the match's load
 *                 and a `match.watch` refused with RATE_LIMITED are sent again.
 * Depends on:     vitest, @testing-library/react, ./useRound, ./useMatch (with ../shell/http's
 *                 `api` and ./socket replaced)
 * Spec:           docs/spec/05-security-threat-model.md §5; docs/spec/09-testing-strategy.md §2
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../shell/http.js';
import { useMatch } from './useMatch.js';
import { useRound } from './useRound.js';

// Each request takes the next answer queued for its path: a value, or an error to throw.
const answers = new Map<string, unknown[]>();
const calls: string[] = [];
vi.mock('../shell/http.js', async (actual) => ({
  ...(await actual<typeof import('../shell/http.js')>()),
  api: (path: string) => {
    calls.push(path);
    const next = answers.get(path)?.shift();
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  },
}));
const intents: { t: string; code?: string }[] = [];
const watchAnswers: unknown[] = [];
vi.mock('./socket.js', () => ({
  gameSocket: () => ({ on: () => undefined, off: () => undefined }),
  intent: (t: string) => {
    intents.push({ t });
    return Promise.resolve(
      t === 'match.watch' ? (watchAnswers.shift() ?? { ok: true }) : { ok: true },
    );
  },
}));

const STATE = '/rounds/r1/state';
const refused = (): ApiError => new ApiError(429, 'RATE_LIMITED');
const countdown = { roundId: 'r1', seq: 1, status: 'countdown', opensAt: 0, frostDelayMs: null };
const open = { roundId: 'r1', seq: 2, status: 'open', frostDelayMs: null };

// Lets the answered promises settle, then moves the clock on.
async function after(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  answers.clear();
  calls.length = 0;
  intents.length = 0;
  watchAnswers.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('a refused round load', () => {
  it('is tried again a second later until it passes', async () => {
    // Far in the future, so T127's load after the opening stays out of the way.
    answers.set(STATE, [{ ...countdown, opensAt: Date.now() + 60_000 }, refused(), open]);
    const { result } = renderHook(() => useRound('r1'));
    await after(0);
    expect(result.current.state?.status).toBe('countdown');
    // The opening's frame brought a load, and the server refused it.
    void result.current.reload();
    await after(0);
    expect(result.current.state?.status).toBe('countdown');
    await after(999);
    expect(calls).toHaveLength(2);
    await after(1);
    expect(calls).toHaveLength(3);
    expect(result.current.state?.status).toBe('open');
  });

  it('is not tried again when the answer is final', async () => {
    answers.set(STATE, [new ApiError(404, 'NOT_FOUND')]);
    renderHook(() => useRound('r1'));
    await after(5_000);
    expect(calls).toEqual([STATE]);
  });
});

describe('the match hook', () => {
  it('loads the match again after a refusal and sends a refused watch again', async () => {
    const path = '/matches/ABC123';
    answers.set(path, [refused(), { code: 'ABC123' }, { code: 'ABC123' }]);
    watchAnswers.push({ ok: false, code: 'RATE_LIMITED' });
    const { result } = renderHook(() => useMatch('ABC123'));
    await after(0);
    expect(result.current.match).toBeNull();
    await after(1_000);
    expect(intents.filter((i) => i.t === 'match.watch')).toHaveLength(2);
    expect(result.current.match).toEqual({ code: 'ABC123' });
  });
});
