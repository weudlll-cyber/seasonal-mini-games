/**
 * @file   apps/web/src/match/GamePrefs.tsx
 * @module web/match
 * @brief  A phased game's own panel in the waiting area: the viewer's pre-picks (04 §4.8 rule 8).
 *
 * Responsibility: for a player of the match whose game has a `Prefs` panel (the registry's web
 *                 half), the panel with the viewer's own value from the match details
 *                 (`myPrefs`, nobody else's), the series' rounds and those played; what the panel
 *                 saves goes to `PUT …/prefs`, and the server's answer (a refusal's code) back to
 *                 the panel. Nothing for spectators or a game without the panel.
 * Depends on:     react, @smg/contracts, @smg-game/registry/web, ../shell/http
 * Used by:        ./WaitingArea
 * Spec:           docs/spec/04-software-architecture.md §4.8 rule 8; docs/spec/02e-game-mind-games.md §7
 */
import type { MatchDetailsView } from '@smg/contracts';
import { GAME_SCREENS } from '@smg-game/registry/web';
import type { ReactElement } from 'react';

import { api, ApiError } from '../shell/http.js';

export function GamePrefs({ match }: { readonly match: MatchDetailsView }): ReactElement | null {
  const Panel = GAME_SCREENS[match.gameId]?.Prefs;
  if (Panel === undefined || !match.youPlayer) return null;
  const save = (prefs: unknown) =>
    api(`/matches/${match.code}/prefs`, { method: 'PUT', body: { prefs } })
      .then(() => ({ ok: true }))
      .catch((error: unknown) => ({
        ok: false,
        code: error instanceof ApiError ? error.code : 'FAILED',
      }));
  return (
    <Panel
      prefs={match.myPrefs ?? null}
      rounds={match.series?.rounds ?? null}
      played={match.series?.played ?? 0}
      save={save}
    />
  );
}
