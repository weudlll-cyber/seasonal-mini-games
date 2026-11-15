/**
 * @file   apps/web/src/round/RoundStandings.tsx
 * @module web/round
 * @brief  The match standings under a game's own result: Player · This round · Total, the top 5.
 *
 * Responsibility: a compact panel beside the next round's box (owner decision O97, T353): the
 *                 match's players in the server's rank order (02 §9), each with the points of
 *                 the round just ended ("—" for a player not in it) and the match total; the
 *                 top five and, when lower down, the viewer's own row, highlighted with "(you)"
 *                 like every result table; "All N players…" shows every row, in the panel's own
 *                 scrolling box, and "Top 5" hides them again. Nothing before the match has a
 *                 standing. The full table with ranks and wins stays on the match summary
 *                 (../match/MatchSummary, ./MatchStandings).
 * Depends on:     react, @smg/contracts (MatchStandingView, PlayerResultView),
 *                 @smg/game-sdk (formatNumber), ./PlayerName
 * Used by:        ./ResultScreen
 * Spec:           docs/spec/02e-game-mind-games.md §9; docs/spec/02-game-guess-the-number.md §9
 */
import type { MatchStandingView, PlayerResultView } from '@smg/contracts';
import { formatNumber } from '@smg/game-sdk';
import { useState, type ReactElement } from 'react';

import { PlayerName } from './PlayerName.js';

const TOP = 5;

// One player's row: the name ("(you)" for the viewer), this round's points, the total.
function Row(p: {
  readonly s: MatchStandingView;
  readonly points: number | undefined;
  readonly you: boolean;
}): ReactElement {
  return (
    <tr className={p.you ? 'round-you' : undefined}>
      <td>
        <span className="round-player">
          <PlayerName name={p.s.name} steps={p.s.steps} />
          {p.you ? <span className="round-you-mark"> (you)</span> : null}
        </span>
      </td>
      <td>{p.points === undefined ? '—' : formatNumber(p.points)}</td>
      <td>{formatNumber(p.s.points)}</td>
    </tr>
  );
}

export function RoundStandings(p: {
  readonly standings: readonly MatchStandingView[];
  readonly results: readonly PlayerResultView[];
  readonly viewerKey: string | null;
}): ReactElement | null {
  const [all, setAll] = useState(false);
  if (p.standings.length === 0) return null;
  const round = new Map(p.results.map((r) => [r.playerId, r.points]));
  const shown = all
    ? p.standings
    : p.standings.filter((s, i) => i < TOP || s.playerKey === p.viewerKey);
  return (
    <section
      className="smg-panel round-standings"
      aria-labelledby="round-standings-title"
      data-testid="round-standings"
    >
      <h2 id="round-standings-title">Standings</h2>
      <div className="round-standings-rows" data-all={all}>
        <table className="round-table" data-testid="match-standings">
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
            {shown.map((s) => (
              <Row
                key={s.playerKey}
                s={s}
                points={round.get(s.playerKey)}
                you={s.playerKey === p.viewerKey}
              />
            ))}
          </tbody>
        </table>
      </div>
      {p.standings.length <= TOP ? null : (
        <button
          type="button"
          className="smg-btn round-standings-more"
          aria-expanded={all}
          data-testid="all-standings"
          onClick={() => {
            setAll(!all);
          }}
        >
          {all ? `Top ${String(TOP)}` : `All ${String(p.standings.length)} players…`}
        </button>
      )}
    </section>
  );
}
