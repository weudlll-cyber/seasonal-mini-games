/**
 * @file   apps/admin/src/http.ts
 * @module admin
 * @brief  Calls to the server's API from the admin app, with the CSRF header.
 *
 * Responsibility: JSON in and out under `api/v1` of the page's base path; the CSRF token of
 *                 the session on every write (Bingo 03 §8); a refusal becomes an ApiError with
 *                 the server's code and detail. The same contract as the player client's
 *                 http.ts (a separate app may not import it, 04 §3).
 * Depends on:     nothing
 * Used by:        ./App, ./*Page
 * Spec:           Bingo 05 §1; Bingo 03 §8
 */

const BASE_PATH = typeof document === 'undefined' ? '/' : new URL('.', document.baseURI).pathname;

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

export async function api<T>(
  path: string,
  options: { readonly method?: string; readonly body?: unknown } = {},
): Promise<T> {
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
