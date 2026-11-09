// @vitest-environment jsdom
/**
 * @file   packages/ui/src/websiteSignIn.test.ts
 * @module ui
 * @brief  Website mode: signing in again after the game session ended goes back to the same page, once.
 *
 * Responsibility: `signInAgain` goes to the sign-in route with the page shown (path, query and
 *                 hash) as `next`; asked again within a minute it stays (no loop) and says so;
 *                 a minute later it goes again. `signInAgainAfter` goes only for an answer with
 *                 X-Smg-Session-Ended, to the route that header names.
 * Depends on:     vitest, ./websiteSignIn
 * Spec:           docs/spec/07-integration.md §7; DECISIONS T282
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { signInAgain, signInAgainAfter } from './websiteSignIn.js';

const SIGN_IN = '/games/mini-games/auth/website';

afterEach(() => {
  vi.useRealTimers();
  window.sessionStorage.clear();
});

describe('signing in again through the website (T282)', () => {
  it('goes back to the page shown, once a minute at most', () => {
    vi.useFakeTimers({ now: 1_000_000 });
    window.history.replaceState(null, '', '/games/mini-games/admin/?x=1#/settings');
    const go = vi.fn();
    expect(signInAgain(SIGN_IN, go)).toBe(true);
    expect(go).toHaveBeenCalledWith(
      `${SIGN_IN}?next=${encodeURIComponent('/games/mini-games/admin/?x=1#/settings')}`,
    );
    vi.setSystemTime(1_000_000 + 59_000);
    expect(signInAgain(SIGN_IN, go)).toBe(false);
    expect(go).toHaveBeenCalledTimes(1);
    vi.setSystemTime(1_000_000 + 61_000);
    expect(signInAgain(SIGN_IN, go)).toBe(true);
    expect(go).toHaveBeenCalledTimes(2);
  });

  it('goes only for an answer that says the session ended', () => {
    window.history.replaceState(null, '', '/games/mini-games/#/match/ABC123');
    const go = vi.fn();
    expect(signInAgainAfter(new Response('{}'), go)).toBe(false);
    const ended = new Response('{}', { headers: { 'x-smg-session-ended': SIGN_IN } });
    expect(signInAgainAfter(ended, go)).toBe(true);
    expect(go).toHaveBeenCalledWith(
      `${SIGN_IN}?next=${encodeURIComponent('/games/mini-games/#/match/ABC123')}`,
    );
  });
});
