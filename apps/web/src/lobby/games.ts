/**
 * @file   apps/web/src/lobby/games.ts
 * @module web/lobby
 * @brief  The installed games (`GET /games`), loaded once per page, and a game's name by its id.
 *
 * Responsibility: one request for the list every screen that names a game shares — the
 *                 create-match form's game choice, the Play list, the Quick Test form, the
 *                 match page and its summary, and the profile's rounds (O41) — and the name for
 *                 an id, the id itself while the list loads or for a game no longer installed.
 * Depends on:     react, @smg/contracts (GameInfoView), ../shell/http
 * Used by:        ./Lobby, ../shell/QuickTest, ../match/MatchSummary, ../match/MatchPage,
 *                 ../boards/ProfilePage
 * Spec:           docs/spec/02-game-guess-the-number.md §2 (owner decision 41); docs/spec/06-data-model-api-realtime.md §3.1
 */
import type { GameInfoView } from '@smg/contracts';
import { useEffect, useState } from 'react';

import { api } from '../shell/http.js';

let loading: Promise<readonly GameInfoView[]> | null = null;

// The list, requested once; a failed request is tried again by the next screen that asks.
function loadGames(): Promise<readonly GameInfoView[]> {
  loading ??= api<{ games: GameInfoView[] }>('/games')
    .then((r) => r.games)
    .catch((error: unknown) => {
      loading = null;
      throw error;
    });
  return loading;
}

export function useGames(): readonly GameInfoView[] {
  const [games, setGames] = useState<readonly GameInfoView[]>([]);
  useEffect(() => {
    let live = true;
    loadGames()
      .then((list) => {
        if (live) setGames(list);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return games;
}

export const gameName = (games: readonly GameInfoView[], id: string): string =>
  games.find((g) => g.id === id)?.name ?? id;
