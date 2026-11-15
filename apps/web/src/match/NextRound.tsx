/**
 * @file   apps/web/src/match/NextRound.tsx
 * @module web/match
 * @brief  The next round's box under a game's own result on the docked page (owner decision O97).
 *
 * Responsibility: beside the standings (../round/RoundStandings) in place of the waiting area's
 *                 column, which the docked page has no room for (./DockedMatch): joining or
 *                 leaving (./JoinLeave); in a series' pause the countdown "Round 3 starts in
 *                 0:11" with its progress bar and, for the host, Start now (./SeriesStatus);
 *                 outside a pause the waiting area's line on who starts the next round
 *                 (./WaitingArea); and the viewer's own panel of a phased game, its pre-picks
 *                 (./GamePrefs). The players' list and the team picker stay in the waiting
 *                 area between rounds; a game that docks its chat has no teams (02e §12).
 * Depends on:     react, @smg/contracts, ./GamePrefs, ./JoinLeave, ./SeriesStatus, ./WaitingArea
 * Used by:        ./MatchPage
 * Spec:           docs/spec/02e-game-mind-games.md §7, §9, §11
 */
import type { MatchDetailsView } from '@smg/contracts';
import type { ReactElement } from 'react';

import { GamePrefs } from './GamePrefs.js';
import { JoinLeave } from './JoinLeave.js';
import { SeriesCountdown } from './SeriesStatus.js';
import { stateText } from './WaitingArea.js';

export function NextRound(p: {
  readonly match: MatchDetailsView;
  // The end of the round just played, where the pause's bar starts.
  readonly since: number | null;
  readonly reload: () => void;
}): ReactElement {
  const { match } = p;
  const pausing = match.series?.nextAt != null;
  return (
    <section
      className="smg-panel next-round"
      aria-labelledby="next-round-title"
      data-testid="next-round"
    >
      <h2 id="next-round-title">Next round</h2>
      <JoinLeave match={match} reload={p.reload} />
      {pausing ? (
        <SeriesCountdown match={match} since={p.since} />
      ) : (
        <p data-testid="waiting-state">{stateText(match)}</p>
      )}
      <GamePrefs match={match} />
    </section>
  );
}
