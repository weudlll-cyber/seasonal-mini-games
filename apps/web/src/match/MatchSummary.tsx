/**
 * @file   apps/web/src/match/MatchSummary.tsx
 * @module web/match
 * @brief  The summary of a closed or aborted match, for every player and spectator (O27).
 *
 * Responsibility: the match's game (O41), how the match ended in plain words (the host ended it; it closed after N
 *                 minutes without a round, O28; it was aborted with its reason), the number of
 *                 rounds played, each player's total points and wins in standings order (the
 *                 result screen's standings table, ../round/MatchStandings, the viewer's line
 *                 highlighted), the team standing over the match (a team match only, O34),
 *                 and a link back to Play. One screen without a page scrollbar at 1280 × 720
 *                 and 390 × 844 for up to 12 players: on a desktop the standings on the left
 *                 and the rounds played, the teams and the link on the right; on a phone one
 *                 column; with more players than fit, only the standings scroll, inside their
 *                 own box (./summary.css). The server gives the figures; the page renders them.
 * Depends on:     react, @smg/contracts, @smg/game-sdk (formatNumber), ../lobby/games,
 *                 ../round/MatchStandings,
 *                 ../round/result.css, ../season/*, ../shell/router, ./summary.css
 * Used by:        ./MatchPage
 * Spec:           docs/spec/02-game-guess-the-number.md §2, §12; docs/spec/03-seasonal-specials.md §5
 */
import type { MatchDetailsView, MatchEndView } from '@smg/contracts';
import { formatNumber } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { gameName, useGames } from '../lobby/games.js';
import { MatchStandings } from '../round/MatchStandings.js';
import { SeasonIcon } from '../season/SeasonIcon.js';
import { teamName } from '../season/season.js';
import { hrefOf } from '../shell/router.js';
// The result page's table, names and team list (one look for both summaries).
import '../round/result.css';
import './summary.css';

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

// The team standing over the match, in a team match that has one (O34).
function Teams({ match }: { readonly match: MatchDetailsView }): ReactElement | null {
  if (!match.teamMatch || match.teamStandings.length === 0) return null;
  return (
    <section aria-labelledby="match-teams-title">
      <h2 id="match-teams-title">Teams over the match</h2>
      <ol className="round-teams-result match-summary-teams" data-testid="match-teams">
        {match.teamStandings.map((t) => (
          <li key={t.team}>
            <SeasonIcon season={t.team} size="1rem" /> {teamName(t.team)}: {formatNumber(t.points)}{' '}
            {t.points === 1 ? 'point' : 'points'}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function MatchSummary({
  match,
  viewerKey,
}: {
  readonly match: MatchDetailsView;
  // The signed-in viewer's player key, to mark their line.
  readonly viewerKey: string | null;
}): ReactElement {
  const games = useGames();
  const end = match.ended;
  const rounds = end?.roundsPlayed ?? 0;
  return (
    // `one-screen`: the shell gives the page exactly the screen's height (../shell/shell.css).
    <section
      className="smg-panel round-result match-summary one-screen"
      data-testid="match-summary"
    >
      <header className="match-summary-head">
        <h1>{match.title} — match over</h1>
        <p className="smg-muted" data-testid="match-game">
          {gameName(games, match.gameId)}
        </p>
        {end === null ? null : <p data-testid="match-end">{endText(match.status, end)}</p>}
      </header>
      <div className="match-summary-standings">
        {/* Without an ended round there is no standing, and the table is left out. */}
        <MatchStandings standings={match.standings} viewerKey={viewerKey} />
      </div>
      <div className="match-summary-side">
        <p data-testid="match-rounds">
          {formatNumber(rounds)} {rounds === 1 ? 'round' : 'rounds'} played.
        </p>
        <Teams match={match} />
        <p>
          <a className="smg-btn smg-btn--primary" href={hrefOf({ name: 'lobby' })}>
            Back to Play
          </a>
        </p>
      </div>
    </section>
  );
}
