/**
 * @file   apps/web/src/boards/useApi.ts
 * @module web/boards
 * @brief  Load one GET answer for a screen, with the server's refusal when there is one.
 *
 * Responsibility: call `GET <path>` when the path changes and keep its answer or its
 *                 ApiError; an answer always belongs to the current path (a stale answer of
 *                 an earlier path is dropped), and `null` loads nothing.
 * Depends on:     react, ../shell/http
 * Used by:        ./LeaderboardPage, ./TeamBoard, ./ProfilePage, ./VerifyPage
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1
 */
import { useEffect, useState } from 'react';

import { api, ApiError } from '../shell/http.js';

export interface Loaded<T> {
  readonly data: T | null;
  readonly error: ApiError | null;
}

const NOTHING = { data: null, error: null } as const;

export function useApi<T>(path: string | null): Loaded<T> {
  const [loaded, setLoaded] = useState<Loaded<T> & { readonly path: string | null }>({
    path: null,
    ...NOTHING,
  });
  useEffect(() => {
    if (path === null) return;
    let current = true;
    api<T>(path).then(
      (data) => {
        if (current) setLoaded({ path, data, error: null });
      },
      (error: unknown) => {
        const refusal = error instanceof ApiError ? error : new ApiError(0, 'NO_ANSWER');
        if (current) setLoaded({ path, data: null, error: refusal });
      },
    );
    return () => {
      current = false;
    };
  }, [path]);
  return loaded.path === path ? loaded : NOTHING;
}
