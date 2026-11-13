/**
 * @file   games/mind-games/web/FeedPanels.tsx
 * @module games/mind-games/web
 * @brief  The feed's head in the info column and on a phone, and a spectator's stage.
 *
 * Responsibility: the head names the feed's time and the players in the round then ("The
 *                 round 30 s ago: 23 players"), and below it the feed's own sentence (./phases):
 *                 when the first choices show ("The first choices show in 12 s."), that every
 *                 change is now a switch once the feed has passed the join time, the replay with
 *                 the seconds to the result (02e §6.1, §6.2). A player's panel in the info column
 *                 is that head (the lines are the round's list below it, ./text); a phone's info
 *                 line is the feed's sentence, else its head, in one line. A spectator (a guest, a
 *                 match player outside the round, an admin) watches on the stage: the phase
 *                 strip, the head and the choice row with the feed's counts, without choosing
 *                 (02e §10). Everything here comes from the delayed view and the round's public
 *                 timing; nothing is counted on the client.
 * Depends on:     react, @smg/game-sdk (panel props), @smg-game/mind-games (views),
 *                 ./ChoiceButtons, ./PhaseStrip, ./phases, ./text
 * Used by:        ./index
 * Spec:           docs/spec/02e-game-mind-games.md §6.1, §6.2, §10, §11
 */
import type { SpectatorView } from '@smg-game/mind-games';
import type { PhasedTiming, PlayerPanelProps, SpectatorPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { ChoiceButtons } from './ChoiceButtons.js';
import { PhaseStrip } from './PhaseStrip.js';
import { feedNote } from './phases.js';
import { emptyText, headText } from './text.js';

// The feed as yet empty: nobody's choice is one delay old.
const empty = (v: SpectatorView) => v.entrants === 0 && v.lines.length === 0;

// The feed's own sentence at this moment, or null (none without the round's timing).
const noteOf = (v: SpectatorView, timing: PhasedTiming | undefined) =>
  timing === undefined ? null : feedNote(timing, v.entrants, empty(v));

export function FeedHead(p: {
  readonly view: SpectatorView;
  readonly timing?: PhasedTiming | undefined;
}): ReactElement {
  const note = noteOf(p.view, p.timing);
  return (
    <div className="mg-feedhead">
      <p className="mg-head" data-testid="feed-head">
        {empty(p.view) ? emptyText(p.view) : headText(p.view)}
      </p>
      {note === null ? null : (
        <p className="mg-note" data-testid="feed-note">
          {note}
        </p>
      )}
    </div>
  );
}

// The info column's panel of a player in the round.
export function MindPlayer(p: PlayerPanelProps): ReactElement {
  return <FeedHead view={p.view as SpectatorView} timing={p.timing} />;
}

// The phone's info line over the stage: the feed's sentence where it has one, else its head.
export function MindLine(p: SpectatorPanelProps): ReactElement {
  const view = p.view as SpectatorView;
  const head = empty(view) ? emptyText(view) : headText(view);
  return <p className="mg-line">{noteOf(view, p.timing) ?? head}</p>;
}

export function MindSpectator(p: SpectatorPanelProps): ReactElement {
  const view = p.view as SpectatorView;
  return (
    <div className="mg-stage" data-testid="mind-stage">
      <PhaseStrip view={view} timing={p.timing} />
      <FeedHead view={view} timing={p.timing} />
      <ChoiceButtons view={view} own={null} choose={null} canAct={false} names={p.names} />
    </div>
  );
}
