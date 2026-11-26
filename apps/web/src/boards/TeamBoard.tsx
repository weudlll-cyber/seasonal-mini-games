/**
 * @file   apps/web/src/boards/TeamBoard.tsx
 * @module web/boards
 * @brief  One board's season teams: rank, team with its icon, points and round wins.
 *
 * Responsibility: the team league of a board as a table beside the player board (below it
 *                 on a phone, ./boards.css); each team by its season icon and name, so colour
 *                 never carries the meaning alone. An empty league says so in one sentence.
 * Depends on:     react, @seasonal/kit/react (useApiGet), @smg/contracts (shapes), ../season/*,
 *                 ../components/fields, ../shell/http, ./boardsText
 * Used by:        ./LeaderboardPage
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/03-seasonal-specials.md §5, §6
 */
import { useApiGet } from '@seasonal/kit/react';
import type { LeaderboardPeriodView, TeamLeagueRowView } from '@smg/contracts';
import type { ReactElement } from 'react';

import { Problem } from '../components/fields.js';
import { SeasonIcon } from '../season/SeasonIcon.js';
import { teamName } from '../season/season.js';
import { api } from '../shell/http.js';
import { refusalText, withGame } from './boardsText.js';

export function TeamBoard({
  period,
  game,
}: {
  readonly period: LeaderboardPeriodView;
  readonly game: string | null;
}): ReactElement {
  const teams = useApiGet<{ rows: TeamLeagueRowView[] }>(
    api,
    withGame(`/leaderboards/${period.id}/teams`, game),
  );
  if (teams.kind === 'failed') return <Problem text={refusalText(teams.error)} />;
  if (teams.kind !== 'ready') return <p className="smg-muted">Loading the teams…</p>;
  const { rows } = teams.value;
  if (rows.length === 0) return <p>No team points on this board yet.</p>;
  return (
    <div className="round-table-wrap">
      <table className="round-table" data-testid="team-board">
        <caption>Teams — {period.name}</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Team</th>
            <th scope="col">Points</th>
            <th scope="col">Wins</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team}>
              <td>{r.rank}</td>
              <td>
                {/* The icon's name is the team's: it is read out once, the text is for the eye. */}
                <SeasonIcon season={r.team} size="1rem" />{' '}
                <span aria-hidden="true">{teamName(r.team)}</span>
              </td>
              <td>{r.points}</td>
              <td>{r.wins}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
