/**
 * @file   games/mind-games/web/PhaseStrip.tsx
 * @module games/mind-games/web
 * @brief  The phase strip: the round's timeline with Join, Play and Replay, now and the feed.
 *
 * Responsibility: one row at the top of the stage (02e §11): the three parts of the plan as
 *                 bars in proportion to their lengths, each with its name and the time it ends
 *                 ("Join · until 1:00"); with the round's timing, a marker for now and one for
 *                 the moment the feed shows (now − delay), and the next change in words
 *                 ("Joining closes in 0:24 · choices close in 0:54", ./phases); and a status
 *                 that a screen reader announces once when the phase changes ("Joining has
 *                 closed.", "Choices are closed."). The server enforces the phases; the strip
 *                 only shows them.
 * Depends on:     react, @smg/game-sdk (PhasedTiming), @smg-game/mind-games (views), ./phases,
 *                 ./text
 * Used by:        ./MindInput, ./FeedPanels
 * Spec:           docs/spec/02e-game-mind-games.md §4, §11
 */
import type { SpectatorView } from '@smg-game/mind-games';
import type { PhasedTiming } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { announcement, nextChange, phaseOf, sinceOpening } from './phases.js';
import { clock } from './text.js';

// A marker's place along the strip, as a share of the round, kept inside it.
const along = (ms: number, endMs: number): string =>
  `${String(Math.min(100, Math.max(0, (ms / endMs) * 100)))}%`;

function Markers(p: { readonly timing: PhasedTiming }): ReactElement {
  const { plan } = p.timing;
  const at = sinceOpening(p.timing);
  return (
    <div className="mg-markers" aria-hidden="true">
      <span
        className="mg-marker mg-marker-feed"
        style={{ left: along(at - plan.viewDelayMs, plan.endMs) }}
      >
        feed
      </span>
      <span className="mg-marker mg-marker-now" style={{ left: along(at, plan.endMs) }}>
        now
      </span>
    </div>
  );
}

export function PhaseStrip(p: {
  readonly view: SpectatorView;
  readonly timing?: PhasedTiming | undefined;
}): ReactElement {
  const plan = p.view.rules.plan;
  const parts = [
    { name: 'Join', from: 0, to: plan.entryEndMs },
    { name: 'Play', from: plan.entryEndMs, to: plan.actionsEndMs },
    { name: 'Replay', from: plan.actionsEndMs, to: plan.endMs },
  ];
  return (
    <div className="mg-timeline" data-testid="phase-strip">
      <ol className="mg-phases" aria-label="The round's phases">
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
      {p.timing === undefined ? null : (
        <>
          <Markers timing={p.timing} />
          <p className="mg-next" data-testid="next-change">
            {nextChange(p.timing)}
          </p>
          <p className="smg-visually-hidden" role="status">
            {announcement(phaseOf(p.timing))}
          </p>
        </>
      )}
    </div>
  );
}
