/**
 * @file   apps/web/src/match/NextRound.tsx
 * @module web/match
 * @brief  The next round's box under a game's own result on the docked page (owner decision O97).
 *
 * Responsibility: beside the standings (../round/RoundStandings) in place of the waiting area's
 *                 column, which the docked page has no room for (./DockedMatch), without a
 *                 heading of its own (the design of MG-N7): joining or leaving (./JoinLeave);
 *                 in a series' pause one row "Round 3 in 0:11" with, for the host,
 *                 Start now, and the progress bar under it (./SeriesStatus);
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
    // No heading of its own (the design of MG-N7): the countdown's row heads the box.
    <section
      className="next-round"
      aria-label="Next round"
      data-testid="next-round"
      // A fixed part of the result's screen: whole at the screen's scale (O111).
      data-sk-fit-fixed=""
    >
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
