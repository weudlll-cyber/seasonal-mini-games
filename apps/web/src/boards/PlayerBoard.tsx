/**
 * @file   apps/web/src/boards/PlayerBoard.tsx
 * @module web/boards
 * @brief  One board's players: the ranked table, "Show more", and the viewer's neighbourhood.
 *
 * Responsibility: the board as a table with a caption (rank, player linking to the profile,
 *                 points, round wins, solves, matches; the viewer's own row highlighted with
 *                 "(you)" as on the result screen), pages of 50 added by "Show more", and,
 *                 for a signed-in viewer who is not among the rows shown, the rows around
 *                 the viewer from `/me`. An empty board says so in one sentence. Ranks come
 *                 from the server (shared on equal points, wins and solves).
 * Depends on:     react, @smg/contracts (shapes), ../shell/http, ../shell/router,
 *                 ../shell/session, ./useApi, ./boardsText
 * Used by:        ./LeaderboardPage
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/06-data-model-api-realtime.md §2.6, §3.1
 */
import type {
  LeaderboardPageView,
  LeaderboardPeriodView,
  LeaderboardRowView,
} from '@smg/contracts';
import { useEffect, useState, type ReactElement } from 'react';

import { Problem } from '../components/fields.js';
import { api } from '../shell/http.js';
import { hrefOf } from '../shell/router.js';
import { useSession } from '../shell/session.js';
import { refusalText } from './boardsText.js';
import { useApi } from './useApi.js';

export function BoardTable(p: {
  readonly caption: string;
  readonly rows: readonly LeaderboardRowView[];
  readonly testId: string;
}): ReactElement {
  return (
    <div className="round-table-wrap">
      <table className="round-table" data-testid={p.testId}>
        <caption>{p.caption}</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Player</th>
            <th scope="col">Points</th>
            <th scope="col">Wins</th>
            <th scope="col">Solves</th>
            <th scope="col">Matches</th>
          </tr>
        </thead>
        <tbody>
          {p.rows.map((r) => (
            <tr key={r.displayName} className={r.you ? 'round-you' : undefined}>
              <td>{r.rank}</td>
              <td>
                <a
                  className="player-name"
                  title={r.displayName}
                  href={hrefOf({ name: 'player', displayName: r.displayName })}
                >
                  {r.displayName}
                </a>
                {r.you ? ' (you)' : ''}
              </td>
              <td>{r.points}</td>
              <td>{r.wins}</td>
              <td>{r.solves}</td>
              <td>{r.matches}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Pages {
  readonly rows: readonly LeaderboardRowView[];
  readonly next: number | null;
}

// The pages loaded so far; "Show more" appends the next one.
function usePages(periodId: string) {
  const first = useApi<LeaderboardPageView>(`/leaderboards/${periodId}`);
  const [more, setMore] = useState<Pages | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const shown = more ?? first.data;
  const loadMore = (): void => {
    if (shown?.next == null) return;
    api<LeaderboardPageView>(`/leaderboards/${periodId}?offset=${String(shown.next)}`).then(
      (page) => {
        setMore({ rows: [...shown.rows, ...page.rows], next: page.next });
        setProblem(null);
      },
      () => {
        setProblem('The next rows did not load. Please try again.');
      },
    );
  };
  return { shown, error: first.error, problem, loadMore };
}

// The rows around a signed-in viewer; nothing for a guest or a viewer without a row.
function useNeighbourhood(periodId: string): readonly LeaderboardRowView[] {
  const signedIn = useSession().session?.account != null;
  const [rows, setRows] = useState<readonly LeaderboardRowView[]>([]);
  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    api<{ rows: LeaderboardRowView[] }>(`/leaderboards/${periodId}/me`).then(
      (r) => {
        if (current) setRows(r.rows);
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [periodId, signedIn]);
  return signedIn ? rows : [];
}

export function PlayerBoard({ period }: { readonly period: LeaderboardPeriodView }): ReactElement {
  const { shown, error, problem, loadMore } = usePages(period.id);
  const around = useNeighbourhood(period.id);
  if (error !== null) return <Problem text={refusalText(error)} />;
  if (shown === null) return <p className="smg-muted">Loading the board…</p>;
  if (shown.rows.length === 0) return <p data-testid="board-empty">No points on this board yet.</p>;
  const youShown = shown.rows.some((r) => r.you);
  return (
    <div className="smg-stack">
      <BoardTable caption={`Players — ${period.name}`} rows={shown.rows} testId="board" />
      {shown.next === null ? null : (
        <button type="button" className="smg-btn boards-more" onClick={loadMore}>
          Show more
        </button>
      )}
      <Problem text={problem} />
      {youShown || around.length === 0 ? null : (
        <BoardTable caption="Your place on this board" rows={around} testId="board-around" />
      )}
    </div>
  );
}
