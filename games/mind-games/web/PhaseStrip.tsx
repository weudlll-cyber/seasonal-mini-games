/**
 * @file   games/mind-games/web/PhaseStrip.tsx
 * @module games/mind-games/web
 * @brief  The phase strip: the round's timeline with Join, Play and Reveal, the phase it is in.
 *
 * Responsibility: one row across the round view's width (02e §11, owner decision O97), the
 *                 kit's `PhaseStrip` with Mind Games' parts, line and announcement: the three
 *                 parts of the plan as segments in proportion to their lengths, each with its
 *                 name and the time it ends ("until 1:00"; on a phone the names only). With the
 *                 round's timing, the part the round is in now has a strong frame, fills with a
 *                 progress fill as it runs and says "· now" in words (`aria-current` too); the
 *                 others stay plain, so colour is never the only sign (O92); a part that has
 *                 ended is marked done, so in the hold before the result (plan end → result,
 *                 T384) no part is "now" and Reveal shows completed, like Join and Play (owner,
 *                 2026-11-18, DECISIONS T386; the strip shows the playing time only, the round
 *                 bar says "Result in 0:04" then). Without the timing no part is current. Under
 *                 the strip one line: "You see the round 10 s late · Joining closes in 0:24 ·
 *                 Choices close in 0:54", only the parts that still apply, and in the hold after
 *                 the plan "Choices closed · result in 0:04" (./phases, T384); a status that a
 *                 screen reader announces once when the phase changes ("Joining has closed.",
 *                 "Choices are closed."). The server enforces the phases; the strip only shows
 *                 them.
 * Depends on:     react, @seasonal/kit/react (PhaseStrip), @smg/game-sdk (PhasedTiming),
 *                 @smg-game/mind-games (views), ./phases
 * Used by:        ./MindInput, ./FeedPanels
 * Spec:           docs/spec/02e-game-mind-games.md §4, §11
 */
import { PhaseStrip as KitPhaseStrip, type PhasePart } from '@seasonal/kit/react';
import type { SpectatorView } from '@smg-game/mind-games';
import type { PhasedTiming } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { announcement, nextChange, phaseOf, sinceOpening } from './phases.js';

export function PhaseStrip(p: {
  readonly view: SpectatorView;
  readonly timing?: PhasedTiming | undefined;
}): ReactElement {
  const plan = p.view.rules.plan;
  const parts: readonly PhasePart[] = [
    { id: 'join', name: 'Join', from: 0, to: plan.entryEndMs },
    { id: 'play', name: 'Play', from: plan.entryEndMs, to: plan.actionsEndMs },
    { id: 'reveal', name: 'Reveal', from: plan.actionsEndMs, to: plan.endMs },
  ];
  const line = (
    <>
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
    </>
  );
  return (
    <KitPhaseStrip
      parts={parts}
      at={p.timing === undefined ? null : sinceOpening(p.timing)}
      label="The round's phases"
      line={line}
      {...(p.timing === undefined ? {} : { status: announcement(phaseOf(p.timing)) })}
    />
  );
}
