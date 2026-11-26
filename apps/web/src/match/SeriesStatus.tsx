/**
 * @file   apps/web/src/match/SeriesStatus.tsx
 * @module web/match
 * @brief  A series of rounds: "Round 3 of 6 · Next round in 12 s", or the next round's countdown
 *         with its progress bar.
 *
 * Responsibility: 04 §4.8 rule 7 as the match page shows it: how many of the series' rounds
 *                 are played, and during a pause the seconds until the next round starts (the
 *                 kit's useCountdown on the server's clock; nothing until it is measured). The
 *                 host gets a
 *                 button that ends the pause at once; its tooltip says so. Two forms with one
 *                 logic (`useSeriesPause`): the waiting area's line (`SeriesStatus`, Start next
 *                 round now) and, under a game's own result on the docked page, the countdown
 *                 "Round 3 in 0:11" (the reference of MG-N8) with a bar that fills from the round's end to the
 *                 next start, and Start now in one row with the words (`SeriesCountdown`, owner
 *                 decision O97 and the design of MG-N7); after the
 *                 last round "The match ends in 0:11", without a button. The server starts the
 *                 round; the page only asks (POST …/next-round/start) and reloads with the match.
 * Depends on:     react, @smg/contracts, ../live/socket (the clock offset), @seasonal/kit
 *                 (clockText), @seasonal/kit/react (useCountdown), ../shell/http
 * Used by:        ./WaitingArea, ./NextRound
 * Spec:           docs/spec/04-software-architecture.md §4.8 rule 7; docs/spec/02e-game-mind-games.md §2, §9
 */
import type { MatchDetailsView } from '@smg/contracts';
import { clockText } from '@seasonal/kit';
import { useCountdown } from '@seasonal/kit/react';
import { useState, type ReactElement } from 'react';

import { useClockOffset } from '../live/socket.js';
import { api } from '../shell/http.js';

const START_TIP =
  'Ends the pause and starts the next round now, with the settings in the Host menu.';

// The series' state now: the round shown, the whole seconds left of the pause (null outside
// one), whether the last round is played, and the host's way to end the pause.
function useSeriesPause(match: MatchDetailsView) {
  const series = match.series ?? null;
  const left = useCountdown(series?.nextAt ?? null, useClockOffset());
  const [busy, setBusy] = useState(false);
  const startNow = (): void => {
    setBusy(true);
    api(`/matches/${match.code}/next-round/start`, { method: 'POST', body: {} })
      .catch(() => undefined)
      .finally(() => {
        setBusy(false);
      });
  };
  if (series === null) return null;
  return {
    rounds: series.rounds,
    played: series.played,
    // The round that just ended, or the next one before any has ended.
    shown: Math.min(series.rounds, Math.max(1, series.played)),
    left,
    nextAt: series.nextAt,
    last: series.played >= series.rounds,
    busy,
    startNow,
  };
}

export function SeriesStatus({ match }: { readonly match: MatchDetailsView }): ReactElement | null {
  const s = useSeriesPause(match);
  if (s === null) return null;
  const { left } = s;
  return (
    <p className="match-series" data-testid="series-status">
      <span>
        Round {String(s.shown)} of {String(s.rounds)}
        {left === null
          ? null
          : s.last
            ? ` · The match ends in ${String(left)} s`
            : ` · Next round in ${String(left)} s`}
      </span>
      {match.youHost && left !== null && !s.last ? (
        <button
          type="button"
          className="smg-button"
          disabled={s.busy}
          title={START_TIP}
          onClick={s.startNow}
        >
          Start next round now
        </button>
      ) : null}
    </p>
  );
}

// The pause's countdown under a game's own result: "Round 3 in 0:11" with the host's
// Start now in one row, the bar under it; null outside a pause. `since` is the end of the
// round just played, where the bar starts.
export function SeriesCountdown(p: {
  readonly match: MatchDetailsView;
  readonly since: number | null;
}): ReactElement | null {
  const s = useSeriesPause(p.match);
  if (s?.left == null || s.nextAt === null) return null;
  const length = p.since === null ? 0 : s.nextAt - p.since;
  const share = length <= 0 ? 0 : Math.min(1, Math.max(0, 1 - (s.left * 1_000) / length));
  const left = clockText(s.left * 1_000);
  const words = s.last ? `The match ends in ${left}` : `Round ${String(s.played + 1)} in ${left}`;
  // One row, the words and the host's button, then the bar: no block of its own (MG-N7).
  return (
    <>
      <div className="next-round-row" data-testid="series-countdown">
        <p className="next-round-when">{words}</p>
        {p.match.youHost && !s.last ? (
          <button
            type="button"
            className="sk-btn next-round-start"
            disabled={s.busy}
            title={START_TIP}
            onClick={s.startNow}
          >
            Start now
          </button>
        ) : null}
      </div>
      <span className="next-round-bar" aria-hidden="true">
        <span style={{ width: `${String(share * 100)}%` }} />
      </span>
    </>
  );
}
