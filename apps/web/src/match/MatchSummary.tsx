/**
 * @file   apps/web/src/match/MatchSummary.tsx
 * @module web/match
 * @brief  The summary of a closed or aborted match, for every player and spectator (O27).
 *
 * Responsibility: how the match ended in plain words (the host ended it; it closed after N
 *                 minutes without a round, O28; it was aborted with its reason), the number of
 *                 rounds played, each player's total points and wins in standings order (the
 *                 result screen's standings table, ../round/MatchStandings, the viewer's line
 *                 highlighted), the team standing over the match (a team match only, O34),
 *                 and a link back to Play.
 *                 The server gives the figures; the page renders them.
 * Depends on:     react, @smg/contracts, @smg/game-sdk (formatNumber), ../round/MatchStandings, ../round/result.css,
 *                 ../season/*, ../shell/router
 * Used by:        ./MatchPage
 * Spec:           docs/spec/02-game-guess-the-number.md §2; docs/spec/03-seasonal-specials.md §5
 */
import type { MatchDetailsView, MatchEndView } from '@smg/contracts';
import { formatNumber } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { MatchStandings } from '../round/MatchStandings.js';
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

export function MatchSummary({
  match,
  viewerKey,
}: {
  readonly match: MatchDetailsView;
  // The signed-in viewer's player key, to mark their line.
  readonly viewerKey: string | null;
}): ReactElement {
  const end = match.ended;
  const rounds = end?.roundsPlayed ?? 0;
  return (
    <section className="smg-panel round-result match-summary" data-testid="match-summary">
      <h1>{match.title} — match over</h1>
      {end === null ? null : <p data-testid="match-end">{endText(match.status, end)}</p>}
      <p>
        {formatNumber(rounds)} {rounds === 1 ? 'round' : 'rounds'} played.
      </p>
      {/* Without an ended round there is no standing, and the table is left out. */}
      <MatchStandings standings={match.standings} viewerKey={viewerKey} />
      {!match.teamMatch || match.teamStandings.length === 0 ? null : (
        <section aria-labelledby="match-teams-title">
          <h2 id="match-teams-title">Teams over the match</h2>
          <ol className="round-teams-result" data-testid="match-teams">
            {match.teamStandings.map((t) => (
              <li key={t.team}>
                <SeasonIcon season={t.team} size="1rem" /> {SEASON_NAMES[t.team]}:{' '}
                {formatNumber(t.points)} {t.points === 1 ? 'point' : 'points'}
              </li>
            ))}
          </ol>
        </section>
      )}
      <p>
        <a className="smg-btn smg-btn--primary" href={hrefOf({ name: 'lobby' })}>
          Back to Play
        </a>
      </p>
    </section>
  );
}
