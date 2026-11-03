/**
 * @file   apps/web/src/round/ResultParts.tsx
 * @module web/round
 * @brief  The result's placings (the top three, "All placings"), its team line and team result.
 *
 * Responsibility: the placings table in place order as the server gave the places, every
 *                 player without a place after them (the viewer by place like everyone else,
 *                 never first for being the viewer, T145), the top three until "All placings
 *                 (N)" shows every one; a name cut with an ellipsis at its end only, "(you)"
 *                 beside it never cut; one team line in the first part ("Team Spring wins the
 *                 round (+1 team point)", "No team wins this round."); the team result below,
 *                 each team's team points named as such, so they read apart from player points.
 *                 Moved out of ./ResultScreen to keep each file under the size limit.
 * Depends on:     react, @smg/contracts, @smg/game-sdk (formatNumber), ../season/*, ./PlayerName
 * Used by:        ./ResultScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/03-seasonal-specials.md §5
 */
import type { RoundStateView } from '@smg/contracts';
import { formatNumber } from '@smg/game-sdk';
import { useState, type ReactElement } from 'react';

import { SeasonIcon } from '../season/SeasonIcon.js';
import { teamName } from '../season/season.js';
import { PlayerName } from './PlayerName.js';

// The first part's placings: the top three.
const TOP = 3;

type Result = NonNullable<RoundStateView['results']>[number];

function placeText(state: RoundStateView, place: number | null): string {
  if (place !== null) return formatNumber(place);
  return state.secretMode === 'shared' ? 'took part' : 'not solved';
}

// By the server's place; the rest after them in the server's order (a stable sort).
export const byPlace = (results: readonly Result[]): Result[] =>
  [...results].sort((a, b) => (a.place ?? Infinity) - (b.place ?? Infinity));

const points = (n: number, what: string): string =>
  `${formatNumber(n)} ${what}${n === 1 ? '' : 's'}`;

// One placing: the place, the team's icon, the name (cut at its end), "(you)" apart from it.
function PlacingRow(p: {
  readonly state: RoundStateView;
  readonly r: Result;
  readonly you: boolean;
}): ReactElement {
  const { r } = p;
  return (
    <tr className={p.you ? 'round-you' : undefined}>
      <td>{placeText(p.state, r.place)}</td>
      <td>
        <span className="round-player">
          {r.team === null ? null : <SeasonIcon season={r.team} size="1rem" />}{' '}
          <PlayerName name={p.state.names[r.playerId] ?? r.playerId} />
          {p.you ? <span className="round-you-mark"> (you)</span> : null}
        </span>
      </td>
      <td>{formatNumber(r.guesses)}</td>
      <td>{formatNumber(r.points)}</td>
    </tr>
  );
}

export function Placings(p: {
  readonly state: RoundStateView;
  readonly viewerKey: string | null;
}): ReactElement {
  const [all, setAll] = useState(false);
  const rows = byPlace(p.state.results ?? []);
  const shown = all ? rows : rows.slice(0, TOP);
  return (
    <div className="round-placings">
      <div className="round-table-wrap">
        <table className="round-table" data-testid="placings">
          <caption className="smg-visually-hidden">Placings</caption>
          <thead>
            <tr>
              <th scope="col" className="round-col-place">
                Place
              </th>
              <th scope="col">Player</th>
              <th scope="col" className="round-col-num">
                Guesses
              </th>
              <th scope="col" className="round-col-num">
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <PlacingRow key={r.playerId} state={p.state} r={r} you={r.playerId === p.viewerKey} />
            ))}
          </tbody>
        </table>
      </div>
      {rows.length <= TOP ? null : (
        <button
          type="button"
          className="smg-btn round-all-placings"
          aria-expanded={all}
          data-testid="all-placings"
          onClick={() => {
            setAll((was) => !was);
          }}
        >
          {all ? 'Top 3 only' : `All placings (${String(rows.length)})`}
        </button>
      )}
    </div>
  );
}

// The first part's one team line, when teams played.
export function teamLine(state: RoundStateView): string | null {
  const teams = state.teams ?? [];
  if (teams.length === 0) return null;
  const won = teams.find((t) => t.won);
  if (won === undefined) return 'No team wins this round.';
  return `${teamName(won.team)} wins the round (+${points(won.points, 'team point')})`;
}

export function TeamLine({ state }: { readonly state: RoundStateView }): ReactElement | null {
  const line = teamLine(state);
  return line === null ? null : (
    <p className="round-team-line" data-testid="team-line">
      {line}
    </p>
  );
}

export function Teams({ state }: { readonly state: RoundStateView }): ReactElement | null {
  const teams = state.teams ?? [];
  if (teams.length === 0) return null;
  return (
    <section aria-labelledby="teams-title">
      <h2 id="teams-title">Team result</h2>
      <ul className="round-teams-result" data-testid="team-result">
        {teams.map((t) => (
          <li key={t.team}>
            <SeasonIcon season={t.team} size="1rem" /> {teamName(t.team)}:{' '}
            {points(t.points, 'team point')}
            {t.won ? ' — the winner’s team' : ''} ({points(t.members, 'player')})
          </li>
        ))}
      </ul>
    </section>
  );
}
