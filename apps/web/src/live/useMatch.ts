/**
 * @file   apps/web/src/live/useMatch.ts
 * @module web/live
 * @brief  A match as the page shows it: its details, kept fresh, and watched over the socket.
 *
 * Responsibility: load `GET /matches/:code`, watch the match room (`match.watch`, again after
 *                 every reconnect, so a player counts as connected for the roster), and load
 *                 again when the room says the match changed or a round frame arrives (a new
 *                 round, a round's status). Leaves the room when the page goes.
 * Depends on:     react, @smg/contracts (shapes), ../shell/http, ./socket
 * Used by:        ../match/MatchPage
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1, §4.2, §4.3
 */
import type { MatchDetailsView } from '@smg/contracts';
import { useCallback, useEffect, useState } from 'react';

import { api, ApiError } from '../shell/http.js';
import { gameSocket, intent } from './socket.js';

export interface MatchState {
  readonly match: MatchDetailsView | null;
  readonly missing: boolean;
  readonly reload: () => Promise<void>;
}

export function useMatch(code: string): MatchState {
  const [match, setMatch] = useState<MatchDetailsView | null>(null);
  const [missing, setMissing] = useState(false);
  const reload = useCallback(async () => {
    try {
      setMatch(await api<MatchDetailsView>(`/matches/${encodeURIComponent(code)}`));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) setMissing(true);
    }
  }, [code]);
  useEffect(() => {
    const socket = gameSocket();
    const watch = (): void => {
      void intent('match.watch', { code }).then(() => reload());
    };
    const changed = (): void => {
      void reload();
    };
    watch();
    socket.on('connect', watch);
    socket.on('match', changed);
    return () => {
      socket.off('connect', watch);
      socket.off('match', changed);
      void intent('match.unwatch', { code });
    };
  }, [code, reload]);
  return { match, missing, reload };
}
