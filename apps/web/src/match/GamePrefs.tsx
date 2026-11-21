/**
 * @file   apps/web/src/match/GamePrefs.tsx
 * @module web/match
 * @brief  A phased game's own panel: the viewer's pre-picks, in the waiting area and in a round.
 *
 * Responsibility: for a player of the match whose game has a `Prefs` panel (the registry's web
 *                 half), the panel with the viewer's own value from the match details
 *                 (`myPrefs`, nobody else's), the series' rounds and those played; what the panel
 *                 saves goes to `PUT …/prefs`, and the server's answer (a refusal's code) back to
 *                 the panel. Nothing for spectators or a game without the panel. During a round
 *                 the same panel opens from the round bar (`RoundPrefs`, O117): only the rounds
 *                 after the running one, saved as the round's own part saves. For the running
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

// During a round, from its bar (O117): the same panel for the rounds after the running one; it
// saves as the round's own part does (the value reloaded after each save).
export function RoundPrefs(p: {
  readonly match: MatchDetailsView;
  readonly own: OwnMatchPart;
}): ReactElement | null {
  const Panel = GAME_SCREENS[p.match.gameId]?.Prefs;
  if (Panel === undefined) return null;
  return (
    <Panel
      prefs={p.own.prefs}
      rounds={p.match.series?.rounds ?? null}
      played={p.own.roundIndex}
      save={p.own.save}
    />
  );
}

// The Pre-picks panel of a round's bar, or null: none for a spectator, a game without the panel
// or the series' last round, which has no later round to pick for.
export function roundPrefsOf(
  match: MatchDetailsView,
  own: OwnMatchPart | undefined,
): ReactElement | null {
  if (own === undefined || GAME_SCREENS[match.gameId]?.Prefs === undefined) return null;
  const rounds = match.series?.rounds ?? null;
  if (rounds !== null && rounds <= own.roundIndex) return null;
  return <RoundPrefs match={match} own={own} />;
}
