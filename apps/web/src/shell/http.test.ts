/**
 * @file   apps/web/src/shell/http.test.ts
 * @module web/shell
 * @brief  The client finds its base path from its own address, and signs in again when the server says the session ended.
 *
 * Responsibility: "/" for a standalone install, "/games/mini-games/" inside the website, with or
 *                 without a hash route or a page file name. An answer with X-Smg-Session-Ended
 *                 (website mode, T282) is handed to `signInAgainAfter` and the call never
 *                 settles while the page leaves; when it stays (its loop guard), the answer
 *                 is handled as usual.
 * Depends on:     vitest, ./http, @smg/ui (signInAgainAfter mocked)
 * Spec:           Bingo 09 §1; docs/spec/07-integration.md §7
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api, ApiError, basePathOf } from './http.js';

// The page's leaving is @smg/ui's (its own test): here only which route it is handed.
const signInAgain = vi.fn((_path: string) => true);
vi.mock('@smg/ui', async (original) => ({
  ...(await original<typeof import('@smg/ui')>()),
  signInAgainAfter: (r: Response) => {
    const path = r.headers.get('x-smg-session-ended');
    return path !== null && signInAgain(path);
  },
}));

const SIGN_IN = '/games/mini-games/auth/website';

afterEach(() => {
  vi.unstubAllGlobals();
  signInAgain.mockClear();
});

describe('the base path', () => {
  it('is the folder of the page address', () => {
    expect(basePathOf('https://bingo.example/')).toBe('/');
    expect(basePathOf('https://site.example/games/mini-games/#/match/ABC123')).toBe(
      '/games/mini-games/',
    );
    expect(basePathOf('https://site.example/games/mini-games/index.html')).toBe(
      '/games/mini-games/',
    );
  });
});

describe('an ended session in website mode (T282)', () => {
  const ended = () =>
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response('{"code":"SIGN_IN_REQUIRED"}', {
            status: 401,
            headers: { 'x-smg-session-ended': SIGN_IN },
          }),
        ),
      ),
    );

  it('signs in again through the website and the call never settles', async () => {
    ended();
    const settled = vi.fn();
    void api('/matches/ABC123').then(settled, settled);
    await vi.waitFor(() => {
      expect(signInAgain).toHaveBeenCalledWith(SIGN_IN);
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(settled).not.toHaveBeenCalled();
  });

  it('answers as usual when it does not go again (the loop guard)', async () => {
    ended();
    signInAgain.mockReturnValueOnce(false);
    await expect(api('/matches/ABC123')).rejects.toEqual(new ApiError(401, 'SIGN_IN_REQUIRED'));
  });
});
