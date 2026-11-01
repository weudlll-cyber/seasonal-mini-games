/**
 * @file   apps/admin/src/http.ts
 * @module admin
 * @brief  Calls to the server's API from the admin app, with the CSRF header.
 *
 * Responsibility: JSON in and out under `api/v1` of the server's base path (the page's own,
 *                 or its parent when the server serves the app under `admin/`); the CSRF
 *                 token of the session on every write (Bingo 03 §8); a refusal becomes an
 *                 ApiError with the server's code and detail. A write answered
 *                 AUTH_STEP_UP_REQUIRED asks the step-up handler (./StepUp) for a fresh
 *                 two-factor check and is sent once more when it succeeded (Bingo 11 §1).
 *                 `failureText` puts a refusal in plain words. The same contract as the
 *                 player client's http.ts (a separate app may not import it, 04 §3).
 * Depends on:     nothing
 * Used by:        ./App, ./StepUp, ./SignIn and every page of the areas
 * Spec:           Bingo 05 §1; Bingo 03 §8
 */

// Served by the server under <base>/admin/ (09 §1), by Vite at the root in development.
const PAGE_PATH = typeof document === 'undefined' ? '/' : new URL('.', document.baseURI).pathname;
const BASE_PATH = PAGE_PATH.endsWith('/admin/') ? PAGE_PATH.slice(0, -'admin/'.length) : PAGE_PATH;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string | null = null,
  ) {
    super(`${String(status)} ${code}`);
  }
}

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

// Asked for a fresh two-factor check; true when the user passed it.
let stepUp: (() => Promise<boolean>) | null = null;

export function setStepUpHandler(handler: (() => Promise<boolean>) | null): void {
  stepUp = handler;
}

interface Options {
  readonly method?: string;
  readonly body?: unknown;
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  try {
    return await send<T>(path, options);
  } catch (error) {
    const ask = stepUp;
    const again = error instanceof ApiError && error.code === 'AUTH_STEP_UP_REQUIRED';
    if (!again || ask === null || !(await ask())) throw error;
    return send<T>(path, options);
  }
}

async function send<T>(path: string, options: Options): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET' && csrfToken !== null) headers['x-csrf-token'] = csrfToken;
  const response = await fetch(`${BASE_PATH}api/v1${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as { code?: string; detail?: string };
  if (!response.ok) throw new ApiError(response.status, body.code ?? 'ERROR', body.detail ?? null);
  return body as T;
}

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
  if (!(error instanceof ApiError)) return `${what} failed.`;
  return `${what} failed: ${CODES[error.code] ?? error.detail ?? error.code}`;
}
