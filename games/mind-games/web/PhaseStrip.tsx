/**
 * @file   games/mind-games/web/PhaseStrip.tsx
 * @module games/mind-games/web
 * @brief  The phase strip: the round's timeline with its three parts, Join, Play and Replay.
 *
 * Responsibility: one row at the top of the stage (02e §11): the three parts of the plan as
 *                 bars in proportion to their lengths, each with its name and the time it ends
 *                 ("Join · until 1:00"), from the plan the view carries. The marker for now and
 *                 for the moment the feed shows, and the next change in words ("Joining closes
 *                 in 0:24"), need the round's opening, which the game's screens do not get yet
 *                 (morning sheet G2); the platform's round bar shows the time left.
 * Depends on:     react, @smg-game/mind-games (views), ./text
 * Used by:        ./MindInput, ./FeedPanels
 * Spec:           docs/spec/02e-game-mind-games.md §4, §11
 */
import type { SpectatorView } from '@smg-game/mind-games';
import type { ReactElement } from 'react';

import { clock } from './text.js';

export function PhaseStrip(p: { readonly view: SpectatorView }): ReactElement {
  const plan = p.view.rules.plan;
  const parts = [
    { name: 'Join', from: 0, to: plan.entryEndMs },
    { name: 'Play', from: plan.entryEndMs, to: plan.actionsEndMs },
    { name: 'Replay', from: plan.actionsEndMs, to: plan.endMs },
  ];
  return (
    <ol className="mg-phases" aria-label="The round's phases" data-testid="phase-strip">
      {parts.map((part) => (
        <li
          key={part.name}
          className="mg-phase"
          data-phase={part.name.toLowerCase()}
          style={{ flexGrow: Math.max(1, part.to - part.from) }}
        >
          <span className="mg-phase-name">{part.name}</span>{' '}
          <span className="mg-phase-time">until {clock(part.to)}</span>
        </li>
      ))}
    </ol>
  );
}
