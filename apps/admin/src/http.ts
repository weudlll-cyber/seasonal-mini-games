/**
 * @file   apps/admin/src/http.ts
 * @module admin
 * @brief  Calls to the server's API from the admin app, with the CSRF header.
 *
 * Responsibility: the kit's createApiClient under `api/v1` of the server's base path (the
 *                 page's own, or its parent when the server serves the app under `admin/`),
 *                 with the session's CSRF token on every write (Bingo 03 §8) and the kit's
 *                 ApiError (no answer at all is status 0). A call answered
 *                 AUTH_STEP_UP_REQUIRED asks the step-up handler (./StepUp) for a fresh
 *                 two-factor check and is sent once more when it succeeded (the client's
 *                 `retry`, Bingo 11 §1). An answer saying the account's session ended (website
 *                 mode) signs in again through the website and back to this page (the kit's
 *                 signInAgainAfter with the contract's SESSION_ENDED_HEADER, T282); the call
 *                 then never settles, as the page is leaving. `refusalOf` reads a refusal's
 *                 sentence and, for a refused setting, its key (`field`, O74); `failureText`
 *                 puts a refusal in plain words. A separate app from the player client, so a
 *                 client of its own (04 §3).
 * Depends on:     @seasonal/kit (createApiClient, ApiError, basePathOf, signInAgainAfter),
 *                 @smg/contracts (SESSION_ENDED_HEADER)
 * Used by:        ./App, ./StepUp, ./SignIn and every page of the areas
 * Spec:           Bingo 05 §1; Bingo 03 §8
 */

import { ApiError, basePathOf, createApiClient, signInAgainAfter } from '@seasonal/kit';
import { SESSION_ENDED_HEADER } from '@smg/contracts';

export { ApiError };

// Served by the server under <base>/admin/ (09 §1), by Vite at the root in development.
const PAGE_PATH = typeof document === 'undefined' ? '/' : basePathOf(document.baseURI);
const BASE_PATH = PAGE_PATH.endsWith('/admin/') ? PAGE_PATH.slice(0, -'admin/'.length) : PAGE_PATH;

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

// Asked for a fresh two-factor check; true when the user passed it.
let stepUp: (() => Promise<boolean>) | null = null;

export function setStepUpHandler(handler: (() => Promise<boolean>) | null): void {
  stepUp = handler;
}

export const api = createApiClient({
  basePath: BASE_PATH,
  csrf: () => csrfToken,
  onAnswer: (response) => signInAgainAfter(response, SESSION_ENDED_HEADER),
  retry: async (error) => error.code === 'AUTH_STEP_UP_REQUIRED' && ((await stepUp?.()) ?? false),
});

// A refusal's own fields: the server's sentence, and the setting it belongs to (O74).
export function refusalOf(error: ApiError): {
  readonly detail: string | null;
  readonly field: string | null;
} {
  const body = error.body as { detail?: unknown; field?: unknown } | null;
  const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);
  return { detail: text(body?.detail), field: text(body?.field) };
}

// A refusal the server answered with; false when no answer came at all.
export const isRefusal = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.status !== 0;

const CODES: Readonly<Record<string, string>> = {
  AUTH_2FA_REQUIRED: 'Set up two-factor sign-in first (Two-factor page).',
  AUTH_STEP_UP_REQUIRED: 'This needs a fresh two-factor check.',
  AUTH_2FA_INVALID: 'That code is not right, or it was used already.',
  FORBIDDEN: 'Your account may not do this.',
  RATE_LIMITED: 'Too many tries. Wait a few minutes.',
  CONFIG_VERSION_CONFLICT: 'Someone changed this meanwhile. Load it again and repeat.',
  VALIDATION_FAILED: 'Something in the form is missing or too short.',
};

// A refusal in plain words: "<what> failed: <why>".
export function failureText(error: unknown, what: string): string {
  if (!isRefusal(error)) return `${what} failed.`;
  return `${what} failed: ${CODES[error.code] ?? refusalOf(error).detail ?? error.code}`;
}
