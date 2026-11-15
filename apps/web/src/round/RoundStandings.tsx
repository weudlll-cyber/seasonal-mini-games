/**
 * @file   apps/web/src/round/RoundStandings.tsx
 * @module web/round
 * @brief  The match standings under a game's own result: Player · This round · Total.
 *
 * Responsibility: a panel beside the next round's box (owner design of 2026-11-15, task MG-N7):
 *                 the title "Standings after round 3", then the match's players in the
 *                 server's rank order (02 §9), each with the points of the round just ended
 *                 ("—" for a player not in it) and the match total. It shows as many rows as
 *                 fit the panel's height, never a scrollbar: the leaders first and the viewer's
 *                 own row always, highlighted with "(you)"; on a phone the top three and the
 *                 viewer (T358). "All N players…" opens the whole list as a sheet over the page,
 *                 which scrolls inside itself; Close or Escape closes it and hands the focus
 *                 back. The whole list stays in the page while hidden, for a reader and the
 *                 tests. The full table with ranks and wins stays on the match summary
 *                 (./MatchStandings).
 * Depends on:     react, @smg/contracts (MatchStandingView, PlayerResultView), @smg/ui
 *                 (useDisclosure), @smg/game-sdk (formatNumber), ./PlayerName, ./useRowsFit
 * Used by:        ./ResultScreen
 * Spec:           docs/spec/02e-game-mind-games.md §9; docs/spec/02-game-guess-the-number.md §9
 */
import type { MatchStandingView, PlayerResultView } from '@smg/contracts';
import { formatNumber } from '@smg/game-sdk';
import { useDisclosure } from '@smg/ui';
import type { ReactElement } from 'react';

import { PlayerName } from './PlayerName.js';
import { useRowsFit } from './useRowsFit.js';

interface TableProps {
  readonly rows: readonly MatchStandingView[];
  readonly round: ReadonlyMap<string, number>;
  readonly viewerKey: string | null;
  readonly testId: string;
}

// The leaders that fit, the viewer's own row in place of the last when it is lower down.
function rowsShown(
  standings: readonly MatchStandingView[],
  viewerKey: string | null,
  fit: number,
): readonly MatchStandingView[] {
  const top = standings.slice(0, fit);
  const own = standings.find((s) => s.playerKey === viewerKey);
  if (own === undefined || top.includes(own) || fit === 0) return top;
  return [...top.slice(0, fit - 1), own];
}

function StandingsTable(p: TableProps): ReactElement {
  return (
    <table className="round-table" data-testid={p.testId}>
      <caption className="smg-visually-hidden">Match standings</caption>
      <thead>
        <tr>
          <th scope="col">Player</th>
          <th scope="col" className="round-col-num">
            This round
          </th>
          <th scope="col" className="round-col-num">
            Total
          </th>
        </tr>
      </thead>
      <tbody>
        {p.rows.map((s) => {
          const you = s.playerKey === p.viewerKey;
          const points = p.round.get(s.playerKey);
          return (
            <tr key={s.playerKey} className={you ? 'round-you' : undefined}>
              <td>
                <span className="round-player">
                  <PlayerName name={s.name} steps={s.steps} />
                  {you ? <span className="round-you-mark"> (you)</span> : null}
                </span>
              </td>
              <td>{points === undefined ? '—' : formatNumber(points)}</td>
              <td>{formatNumber(s.points)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function RoundStandings(p: {
  readonly standings: readonly MatchStandingView[];
  readonly results: readonly PlayerResultView[];
  readonly viewerKey: string | null;
  // The round just ended, by its number in the match; null outside a series.
  readonly round: number | null;
}): ReactElement | null {
  const sheet = useDisclosure();
  const fit = useRowsFit<HTMLDivElement>(p.standings.length > 0);
  if (p.standings.length === 0) return null;
  const round = new Map(p.results.map((r) => [r.playerId, r.points]));
  const shown = rowsShown(p.standings, p.viewerKey, fit.rows);
  const title = p.round === null ? 'Standings' : `Standings after round ${String(p.round)}`;
  const table = { round, viewerKey: p.viewerKey };
  return (
    <section
      className="round-standings"
      aria-labelledby="round-standings-title"
      data-testid="round-standings"
      onKeyDown={sheet.onKeyDown}
    >
      <h2 id="round-standings-title">{title}</h2>
      {/* The rows that fit this box's height; the box never scrolls. */}
      <div className="round-standings-rows" ref={fit.ref}>
        <StandingsTable {...table} rows={shown} testId="match-standings" />
      </div>
      {shown.length >= p.standings.length ? null : (
        <button
          ref={sheet.button}
          type="button"
          className="round-standings-more"
          aria-expanded={sheet.open}
          aria-controls={sheet.panelId}
          data-testid="all-standings"
          onClick={sheet.toggle}
        >
          All {p.standings.length} players…
        </button>
      )}
      <div
        id={sheet.panelId}
        className="round-standings-sheet"
        role="dialog"
        aria-label={title}
        hidden={!sheet.open}
      >
        <header className="focus-panel-head">
          <h2>{title}</h2>
          <button type="button" className="smg-btn" onClick={sheet.close}>
            Close
          </button>
        </header>
        <StandingsTable {...table} rows={p.standings} testId="match-standings-all" />
      </div>
    </section>
  );
}
