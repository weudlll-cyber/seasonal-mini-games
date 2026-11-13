/**
 * @file   games/mind-games/web/FeedPanels.tsx
 * @module games/mind-games/web
 * @brief  The feed's head in the info column and on a phone, and a spectator's stage.
 *
 * Responsibility: the head names the feed's time and the players in the round then ("The
 *                 round 30 s ago: 23 players"), or before the first choice reaches it when the
 *                 first choices show (02e §6.1); a player's panel in the info column is that
 *                 head (the lines are the round's list below it, ./text); a phone's info line
 *                 is the same head in one line. A spectator (a guest, a match player outside
 *                 the round, an admin) watches on the stage: the phase strip, the head and the
 *                 choice row with the feed's counts, without choosing (02e §10). Everything
 *                 here comes from the delayed view; nothing is counted on the client.
 * Depends on:     react, @smg/game-sdk (panel props), @smg-game/mind-games (views),
 *                 ./ChoiceButtons, ./PhaseStrip, ./text
 * Used by:        ./index
 * Spec:           docs/spec/02e-game-mind-games.md §6.1, §10, §11
 */
import type { SpectatorView } from '@smg-game/mind-games';
import type { SpectatorPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { ChoiceButtons } from './ChoiceButtons.js';
import { PhaseStrip } from './PhaseStrip.js';
import { emptyText, headText } from './text.js';

// The feed as yet empty: nobody's choice is one delay old.
const empty = (v: SpectatorView) => v.entrants === 0 && v.lines.length === 0;

export function FeedHead(p: { readonly view: SpectatorView }): ReactElement {
  return (
    <p className="mg-head" data-testid="feed-head">
      {empty(p.view) ? emptyText(p.view) : headText(p.view)}
    </p>
  );
}

// The info column's panel of a player in the round.
export function MindPlayer(p: { readonly view: unknown }): ReactElement {
  return <FeedHead view={p.view as SpectatorView} />;
}

// The phone's info line over the stage.
export function MindLine(p: SpectatorPanelProps): ReactElement {
  const view = p.view as SpectatorView;
  return <p className="mg-line">{empty(view) ? emptyText(view) : headText(view)}</p>;
}

export function MindSpectator(p: SpectatorPanelProps): ReactElement {
  const view = p.view as SpectatorView;
  return (
    <div className="mg-stage" data-testid="mind-stage">
      <PhaseStrip view={view} />
      <FeedHead view={view} />
      <ChoiceButtons view={view} own={null} choose={null} canAct={false} />
    </div>
  );
}
