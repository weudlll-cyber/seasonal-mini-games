/**
 * @file   apps/web/src/match/SeriesStatus.tsx
 * @module web/match
 * @brief  A series of rounds in the waiting area: "Round 3 of 6 · Next round in 12 s".
 *
 * Responsibility: 04 §4.8 rule 7 as the match page shows it: how many of the series' rounds
 *                 are played, and during a pause the seconds until the next round starts (from
 *                 the server's time, counted down with the shared ticker). The host gets Start
 *                 next round now, which ends the pause at once; its tooltip says so. The server
 *                 starts the round; the page only asks (POST …/next-round/start) and reloads
 *                 with the match.
 * Depends on:     react, @smg/contracts, ../live/socket (server time), ../live/useTicker, ../shell/http
 * Used by:        ./WaitingArea
 * Spec:           docs/spec/04-software-architecture.md §4.8 rule 7; docs/spec/02e-game-mind-games.md §2, §9
 */
import type { MatchDetailsView } from '@smg/contracts';
import { useState, type ReactElement } from 'react';

import { serverNow } from '../live/socket.js';
import { useTicker } from '../live/useTicker.js';
import { api } from '../shell/http.js';

export function SeriesStatus({ match }: { readonly match: MatchDetailsView }): ReactElement | null {
  const series = match.series ?? null;
  const pausing = series?.nextAt != null;
  useTicker(pausing, 1_000);
  const [busy, setBusy] = useState(false);
  if (series === null) return null;
  // The round that just ended, or the next one before any has ended.
  const shown = Math.min(series.rounds, Math.max(1, series.played));
  const left =
    series.nextAt === null ? null : Math.max(0, Math.ceil((series.nextAt - serverNow()) / 1_000));
  const last = series.played >= series.rounds;
  const startNow = (): void => {
    setBusy(true);
    api(`/matches/${match.code}/next-round/start`, { method: 'POST', body: {} })
      .catch(() => undefined)
      .finally(() => {
        setBusy(false);
      });
  };
  return (
    <p className="match-series" data-testid="series-status">
      <span>
        Round {String(shown)} of {String(series.rounds)}
        {left === null
          ? null
          : last
            ? ` · The match ends in ${String(left)} s`
            : ` · Next round in ${String(left)} s`}
      </span>
      {match.youHost && left !== null && !last ? (
        <button
          type="button"
          className="smg-button"
          disabled={busy}
          title="Ends the pause and starts the next round now, with the settings in the Host menu."
          onClick={startNow}
        >
          Start next round now
        </button>
      ) : null}
    </p>
  );
}
