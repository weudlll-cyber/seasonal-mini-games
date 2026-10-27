/**
 * @file   apps/web/src/round/MatchStandings.tsx
 * @module web/round
 * @brief  The match's player standings on the result screen: rank, player, points, round wins.
 *
 * Responsibility: the sum over the match's ended rounds as the server ranks it (02 §9), as a
 *                 table with the viewer's line highlighted like the placings; nothing before
 *                 the match has a standing.
 * Depends on:     react, @smg/contracts (MatchStandingView), ./PlayerName
 * Used by:        ./ResultScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §9
 */
import type { MatchStandingView } from '@smg/contracts';
import type { ReactElement } from 'react';

import { PlayerName } from './PlayerName.js';

export function MatchStandings({
  standings,
  viewerKey,
}: {
  readonly standings: readonly MatchStandingView[];
  readonly viewerKey: string | null;
}): ReactElement | null {
  if (standings.length === 0) return null;
  return (
    <section aria-labelledby="standings-title">
      <h2 id="standings-title">Match standings</h2>
      <div className="round-table-wrap">
        <table className="round-table" data-testid="match-standings">
          <caption className="smg-visually-hidden">Match standings</caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Player</th>
              <th scope="col">Points</th>
              <th scope="col">Wins</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.playerKey} className={s.playerKey === viewerKey ? 'round-you' : undefined}>
                <td>{s.rank}</td>
                <td>
                  <PlayerName name={s.name} />
                  {s.playerKey === viewerKey ? ' (you)' : ''}
                </td>
                <td>{s.points}</td>
                <td>{s.wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
