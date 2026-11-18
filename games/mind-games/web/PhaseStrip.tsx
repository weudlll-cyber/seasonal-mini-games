/**
 * @file   games/mind-games/web/PhaseStrip.tsx
 * @module games/mind-games/web
 * @brief  The phase strip: the round's timeline with Join, Play and Reveal, the phase it is in.
 *
 * Responsibility: one row across the round view's width (02e §11, owner decision O97): the
 *                 three parts of the plan as segments in proportion to their lengths, each with
 *                 its name and the time it ends ("until 1:00"; on a phone the names only). With
 *                 the round's timing, the part the round is in now has a strong frame, fills
 *                 with a progress fill as it runs and says "· now" in words (`aria-current`
 *                 too); the others stay plain, so colour is never the only sign (O92). Under
 *                 the strip one line: "You see the round 10 s late · Joining closes in 0:24 ·
 *                 Choices close in 0:54", only the parts that still apply, and in the hold
 *                 after the plan "Choices closed · result in 0:04" (./phases, T384); a status
 *                 that a screen reader announces once when the phase changes ("Joining has
 *                 closed.", "Choices are closed."). The server enforces the phases; the strip
 *                 only shows them.
 * Depends on:     react, @smg/game-sdk (clockText, PhasedTiming), @smg-game/mind-games (views),
 *                 ./phases
 * Used by:        ./MindInput, ./FeedPanels
 * Spec:           docs/spec/02e-game-mind-games.md §4, §11
 */
import type { SpectatorView } from '@smg-game/mind-games';
import { clockText, type PhasedTiming } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { announcement, nextChange, phaseOf, sinceOpening, type Phase } from './phases.js';

interface Part {
  readonly name: string;
  readonly phase: Phase;
  readonly from: number;
  readonly to: number;
}

// How far the current part has run, as a share of it, kept inside it.
const filled = (part: Part, at: number): string =>
  `${String(Math.min(100, Math.max(0, ((at - part.from) / Math.max(1, part.to - part.from)) * 100)))}%`;

function PartItem(p: { readonly part: Part; readonly at: number | null }): ReactElement {
  const { part } = p;
  const current = p.at !== null;
  return (
    <li
      className="mg-phase"
      data-phase={part.phase}
      data-current={current}
      aria-current={current ? 'step' : undefined}
      style={{ flexGrow: Math.max(1, part.to - part.from) }}
    >
      {p.at === null ? null : (
        <span className="mg-phase-fill" aria-hidden="true" style={{ width: filled(part, p.at) }} />
      )}
      <span className="mg-phase-name">
        {part.name}
        {current ? <span className="mg-phase-now"> · now</span> : null}
      </span>{' '}
      <span className="mg-phase-time">until {clockText(part.to)}</span>
    </li>
  );
}

export function PhaseStrip(p: {
  readonly view: SpectatorView;
  readonly timing?: PhasedTiming | undefined;
}): ReactElement {
  const plan = p.view.rules.plan;
  const parts: readonly Part[] = [
    { name: 'Join', phase: 'join', from: 0, to: plan.entryEndMs },
    { name: 'Play', phase: 'play', from: plan.entryEndMs, to: plan.actionsEndMs },
    { name: 'Reveal', phase: 'reveal', from: plan.actionsEndMs, to: plan.endMs },
  ];
  const now = p.timing === undefined ? null : phaseOf(p.timing);
  const at = p.timing === undefined ? 0 : sinceOpening(p.timing);
  return (
    <div className="mg-timeline" data-testid="phase-strip">
      <ol className="mg-phases" aria-label="The round's phases">
        {parts.map((part) => (
          <PartItem key={part.name} part={part} at={part.phase === now ? at : null} />
        ))}
      </ol>
      <p className="mg-strip-line">
        <span data-testid="delay-line">
          You see the round {String(Math.round(plan.viewDelayMs / 1_000))} s late
        </span>
        {p.timing === undefined ? null : (
          <>
            {' · '}
            <span className="mg-next" data-testid="next-change">
              {nextChange(p.timing)}
            </span>
          </>
        )}
      </p>
      {p.timing === undefined ? null : (
        <p className="smg-visually-hidden" role="status">
          {announcement(phaseOf(p.timing))}
        </p>
      )}
    </div>
  );
}
