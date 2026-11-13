/**
 * @file   apps/web/src/match/GamePrefs.tsx
 * @module web/match
 * @brief  A phased game's own panel in the waiting area: the viewer's pre-picks (04 §4.8 rule 8).
 *
 * Responsibility: for a player of the match whose game has a `Prefs` panel (the registry's web
 *                 half), the panel with the viewer's own value from the match details
 *                 (`myPrefs`, nobody else's), the series' rounds and those played; what the panel
 *                 saves goes to `PUT …/prefs`, and the server's answer (a refusal's code) back to
 *                 the panel. Nothing for spectators or a game without the panel. For the running
 *                 round, the viewer's own part of the match (`useOwnPart`: the round's number,
 *                 the value and its saving, a pre-pick refused at the opening, T327).
 * Depends on:     react, @smg/contracts, @smg/game-sdk (types), @smg-game/registry/web,
 *                 ../live/socket, ../shell/http
 * Used by:        ./WaitingArea, ./MatchPage
 * Spec:           docs/spec/04-software-architecture.md §4.8 rule 8; docs/spec/02e-game-mind-games.md §7
 */
import type { MatchDetailsView } from '@smg/contracts';
import { GAME_SCREENS } from '@smg-game/registry/web';
import type { OwnMatchPart } from '@smg/game-sdk';
import { useEffect, useState, type ReactElement } from 'react';

import { gameSocket } from '../live/socket.js';
import { api, ApiError } from '../shell/http.js';

// The viewer's own value saved through `PUT …/prefs`, and the server's answer (a refusal's code).
const savePrefs =
  (code: string) =>
  (prefs: unknown): Promise<{ readonly ok: boolean; readonly code?: string }> =>
    api(`/matches/${code}/prefs`, { method: 'PUT', body: { prefs } })
      .then(() => ({ ok: true }))
      .catch((error: unknown) => ({
        ok: false,
        code: error instanceof ApiError ? error.code : 'FAILED',
      }));

// The viewer's own part of a phased game's running round (T327): the round's number in the
// match, their value, saving it (and reloading the details, so the page holds the new value),
// and a pre-pick refused at this round's opening as the server told it (`prefs.refused`, to the
// player's own room only, T301); undefined for a spectator or a game without prefs.
export function useOwnPart(
  match: MatchDetailsView,
  reload: () => Promise<void>,
): OwnMatchPart | undefined {
  const [refused, setRefused] = useState<{ roundIndex: number; code: string } | null>(null);
  useEffect(() => {
    const socket = gameSocket();
    const onRefused = (r: { roundIndex: number; code: string }): void => {
      setRefused(r);
    };
    socket.on('prefs.refused', onRefused);
    return () => {
      socket.off('prefs.refused', onRefused);
    };
  }, []);
  if (GAME_SCREENS[match.gameId]?.Prefs === undefined || !match.youPlayer) return undefined;
  const roundIndex = (match.series?.played ?? 0) + 1;
  const save = savePrefs(match.code);
  return {
    roundIndex,
    prefs: match.myPrefs ?? null,
    save: (prefs) => save(prefs).finally(() => void reload()),
    refusedPrePick: refused?.roundIndex === roundIndex ? refused.code : null,
  };
}

export function GamePrefs({ match }: { readonly match: MatchDetailsView }): ReactElement | null {
  const Panel = GAME_SCREENS[match.gameId]?.Prefs;
  if (Panel === undefined || !match.youPlayer) return null;
  const save = savePrefs(match.code);
  return (
    <Panel
      prefs={match.myPrefs ?? null}
      rounds={match.series?.rounds ?? null}
      played={match.series?.played ?? 0}
      save={save}
    />
  );
}
