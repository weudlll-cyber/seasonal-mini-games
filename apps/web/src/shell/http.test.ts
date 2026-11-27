/**
 * @file   apps/web/src/shell/http.test.ts
 * @module web/shell
 * @brief  The client signs in again when the server says the session ended; a refused setting is read.
 *
 * Responsibility: the base path and the calls themselves are the kit's (its own tests). Here
 *                 the game's part: an answer with X-Smg-Session-Ended
 *                 (website mode, T282) is handed to `signInAgainAfter` and the call never
 *                 settles while the page leaves; when it stays (its loop guard), the answer
 *                 is handled as usual. A refused setting's key and sentence come from the
 *                 answer (O74).
 * Depends on:     vitest, ./http, @seasonal/kit (signInAgainAfter mocked)
 * Spec:           Bingo 09 §1; docs/spec/07-integration.md §7
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api, ApiError, refusalOf } from './http.js';

// The page's leaving is the kit's (its own test): here only which route it is handed, read
// from the header the client names.
const signInAgain = vi.fn((_path: string) => true);
vi.mock('@seasonal/kit', async (original) => ({
  ...(await original<typeof import('@seasonal/kit')>()),
  signInAgainAfter: (r: Response, header: string) => {
    const path = r.headers.get(header);
    return path !== null && signInAgain(path);
  },
}));

const SIGN_IN = '/games/mini-games/auth/website';

afterEach(() => {
  vi.unstubAllGlobals();
  signInAgain.mockClear();
});

describe('a refused setting (O74)', () => {
  it('has a key and a sentence, else nothing', () => {
    const body = { code: 'ROUND_SETTINGS_INVALID', field: 'round.limit', detail: 'Too high.' };
    expect(refusalOf(new ApiError(422, body.code, null, body))).toEqual({
      field: 'round.limit',
      detail: 'Too high.',
    });
    expect(refusalOf(new ApiError(422, body.code, null, { field: null, detail: 'x' }))).toBeNull();
    expect(refusalOf(new Error('offline'))).toBeNull();
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
    await expect(api('/matches/ABC123')).rejects.toMatchObject({
      status: 401,
      code: 'SIGN_IN_REQUIRED',
    });
  });
});
