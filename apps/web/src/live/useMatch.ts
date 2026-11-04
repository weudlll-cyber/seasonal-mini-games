/**
 * @file   apps/web/src/live/useMatch.ts
 * @module web/live
 * @brief  A match as the page shows it: its details, kept fresh, and watched over the socket.
 *
 * Responsibility: load `GET /matches/:code`, watch the match room (`match.watch`, again after
 *                 every reconnect, so a player counts as connected for the roster), and load
 *                 again when the room says the match changed (joins, teams, a new round, a
 *                 round's end with the new standings). A load or a watch refused for the
 *                 moment (the session's API budget spent, the socket's 10 intents a second)
 *                 is tried again a second later (T185). Leaves the room when the page goes.
 * Depends on:     react, @smg/contracts (shapes), ../shell/http, ./retry, ./socket
 * Used by:        ../match/MatchPage
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1, §4.2, §4.3
 */
import type { MatchDetailsView } from '@smg/contracts';
import { useCallback, useEffect, useState } from 'react';

import { api, ApiError } from '../shell/http.js';
import { retryable, useRetry } from './retry.js';
import { gameSocket, intent } from './socket.js';

export interface MatchState {
  readonly match: MatchDetailsView | null;
  readonly missing: boolean;
  readonly reload: () => Promise<void>;
}

export function useMatch(code: string): MatchState {
  const [match, setMatch] = useState<MatchDetailsView | null>(null);
  const [missing, setMissing] = useState(false);
  // A refused load and a refused watch are each tried again (T185).
  const loadRetry = useRetry().later;
  const { later: watchRetry, cancel } = useRetry();
  const reload = useCallback(async () => {
    try {
      setMatch(await api<MatchDetailsView>(`/matches/${encodeURIComponent(code)}`));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) setMissing(true);
      else if (retryable(error)) loadRetry(() => void reload());
    }
  }, [code, loadRetry]);
  useEffect(() => {
    const socket = gameSocket();
    // Outside the room the page gets no frame at all: a watch refused by the socket's limit
    // (a burst of intents when the page changes match) is sent again (T185).
    const watch = (): void => {
      void intent('match.watch', { code }).then((answer) => {
        if (answer.code === 'RATE_LIMITED') watchRetry(watch);
        return reload();
      });
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
      cancel();
      void intent('match.unwatch', { code });
    };
  }, [code, reload, watchRetry, cancel]);
  return { match, missing, reload };
}
