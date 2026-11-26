/**
 * @file   apps/web/src/shell/http.ts
 * @module web/shell
 * @brief  The player client's one API client: the kit's, with this game's CSRF token and sign-in.
 *
 * Responsibility: `api` calls the server's /api/v1 relative to where the client is served
 *                 (BASE_PATH) through the kit's createApiClient: same-origin credentials (the
 *                 dev server proxies /api), the session's CSRF token on every state-changing
 *                 call (03 §8), JSON in and out, and the kit's ApiError (no answer at all is
 *                 status 0, `NO_ANSWER`). An answer saying the account's session ended (website
 *                 mode) signs in again through the website (the kit's signInAgainAfter with the
 *                 contract's SESSION_ENDED_HEADER, T282); the call then never settles, as the
 *                 page is leaving. `refusalOf` reads a refused setting's key and sentence from
 *                 the answer (O74).
 * Depends on:     @seasonal/kit (createApiClient, ApiError, basePathOf, signInAgainAfter),
 *                 @smg/contracts (SESSION_ENDED_HEADER)
 * Used by:        ./session, ./handoffLanding, ./QuickTest, ../account/*, ../boards/*, ../chat/*,
 *                 ../embed/embedHost, ../live/*, ../lobby/*, ../match/*
 * Spec:           Bingo 05 §1; Bingo 03 §8
 */

import { ApiError, basePathOf, createApiClient, signInAgainAfter } from '@seasonal/kit';
import { SESSION_ENDED_HEADER } from '@smg/contracts';

export { ApiError };

// Where the client is served: "/" standalone, "/games/mini-games/" inside the website. The page
// routes with the URL hash, so the folder of its address is the base (09 §1).
export const BASE_PATH = typeof document === 'undefined' ? '/' : basePathOf(document.baseURI);

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export const api = createApiClient({
  basePath: BASE_PATH,
  csrf: () => csrfToken,
  onAnswer: (response) => signInAgainAfter(response, SESSION_ENDED_HEADER),
});

// A refused setting's key and sentence (SettingRefusalView, O74), else null.
export function refusalOf(
  error: unknown,
): { readonly field: string; readonly detail: string } | null {
  if (!(error instanceof ApiError)) return null;
  const body = error.body as { field?: unknown; detail?: unknown } | null;
  return typeof body?.field === 'string' && typeof body.detail === 'string'
    ? { field: body.field, detail: body.detail }
    : null;
}
