/**
 * @file   apps/web/src/live/retry.ts
 * @module web/live
 * @brief  Trying a refused load or watch again a second later (T185).
 *
 * Responsibility: say whether a failed request is worth trying again — the session's API
 *                 budget spent (429, 05 §5 / Bingo 03 §13), a server error, no answer at all —
 *                 or final (404, 403, …); and keep one pending retry, `RETRY_MS` later,
 *                 cancelled when the caller says so or the component goes. The per-session
 *                 budget refills two requests a second and the socket's intents ten, so one
 *                 try a second gets through once the burst that spent it is over.
 * Depends on:     react, ../shell/http (ApiError)
 * Used by:        ./useMatch, ./useRound
 * Spec:           docs/spec/05-security-threat-model.md §5; docs/spec/06-data-model-api-realtime.md §3.1
 */
import { useCallback, useEffect, useRef } from 'react';

import { ApiError } from '../shell/http.js';

const RETRY_MS = 1_000;

// A refusal that passes (rate limit, server trouble, the network) rather than a final answer.
export function retryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status === 429 || error.status >= 500;
}

interface Retry {
  // Runs `again` after RETRY_MS, unless a retry is already pending.
  readonly later: (again: () => void) => void;
  readonly cancel: () => void;
}

export function useRetry(): Retry {
  const timer = useRef<number | null>(null);
  const later = useCallback((again: () => void) => {
    timer.current ??= window.setTimeout(() => {
      timer.current = null;
      again();
    }, RETRY_MS);
  }, []);
  const cancel = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  return { later, cancel };
}
