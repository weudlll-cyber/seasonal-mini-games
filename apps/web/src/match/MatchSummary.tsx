/**
 * @file   apps/web/src/match/MatchSummary.tsx
 * @module web/match
 * @brief  The summary of a closed or aborted match, for every player and spectator (O27).
 *
 * Responsibility: how the match ended in plain words (the host ended it; it closed after N
 *                 minutes without a round, O28; it was aborted with its reason), the number of
 *                 rounds played, each player's total points and wins in standings order (names
 *                 on one line with an ellipsis, ../round/PlayerName), the team standing over
 *                 the match, and a link back to Play. The server gives the figures; the page
 *                 renders them.
 * Depends on:     react, @smg/contracts, ../round/PlayerName, ../round/result.css, ../season/*,
 *                 ../shell/router
 * Used by:        ./MatchPage
 * Spec:           docs/spec/02-game-guess-the-number.md §2; docs/spec/03-seasonal-specials.md §5
 */
import type { MatchDetailsView, MatchEndView } from '@smg/contracts';
import type { ReactElement } from 'react';

import { PlayerName } from '../round/PlayerName.js';
import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASON_NAMES } from '../season/season.js';
import { hrefOf } from '../shell/router.js';
// The result page's table, names and team list (one look for both summaries).
import '../round/result.css';

// How the match ended, in one sentence.
export function endText(status: MatchDetailsView['status'], end: MatchEndView): string {
  if (status === 'aborted') {
    return end.reason === null ? 'The match was aborted.' : `The match was aborted: ${end.reason}.`;
  }
  if (end.reason === 'idle') {
    const n = end.idleMinutes ?? 0;
    return `The match closed after ${String(n)} ${n === 1 ? 'minute' : 'minutes'} without a round.`;
  }
  return 'The host ended the match.';
}

function Standings({ end }: { readonly end: MatchEndView }): ReactElement {
  if (end.players.length === 0) return <p className="smg-muted">Nobody scored in this match.</p>;
  return (
    <div className="round-table-wrap">
      <table className="round-table" data-testid="match-standings">
        <caption className="smg-visually-hidden">Players</caption>
        <thead>
          <tr>
            <th scope="col" className="round-col-place">
              Rank
            </th>
            <th scope="col">Player</th>
            <th scope="col" className="round-col-num">
              Points
            </th>
            <th scope="col" className="round-col-num">
              Wins
            </th>
          </tr>
        </thead>
        <tbody>
          {end.players.map((p, i) => (
            // Names may repeat; the rank order is the identity here.
            <tr key={i}>
              <td>{i + 1}</td>
              <td>
                <span className="round-player">
                  {p.team === null ? null : <SeasonIcon season={p.team} size="1rem" />}{' '}
                  <PlayerName name={p.name} />
                </span>
              </td>
              <td>{p.points}</td>
              <td>{p.wins}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MatchSummary({ match }: { readonly match: MatchDetailsView }): ReactElement {
  const end = match.ended;
  const rounds = end?.roundsPlayed ?? 0;
  return (
    <section className="smg-panel round-result match-summary" data-testid="match-summary">
      <h1>{match.title} — match over</h1>
      {end === null ? null : (
        <>
          <p data-testid="match-end">{endText(match.status, end)}</p>
          <p>
            {rounds} {rounds === 1 ? 'round' : 'rounds'} played.
          </p>
          <Standings end={end} />
          {end.teams.length === 0 ? null : (
            <section aria-labelledby="match-teams-title">
              <h2 id="match-teams-title">Teams over the match</h2>
              <ol className="round-teams-result" data-testid="match-teams">
                {end.teams.map((t) => (
                  <li key={t.team}>
                    <SeasonIcon season={t.team} size="1rem" /> {SEASON_NAMES[t.team]}: {t.points}{' '}
                    {t.points === 1 ? 'point' : 'points'}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
      <p>
        <a className="smg-btn smg-btn--primary" href={hrefOf({ name: 'lobby' })}>
          Back to Play
        </a>
      </p>
    </section>
  );
}
