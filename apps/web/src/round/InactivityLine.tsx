/**
 * @file   apps/web/src/round/InactivityLine.tsx
 * @module web/round
 * @brief  The inactivity countdown at the input row: "30 s left for your next guess" (O71).
 *
 * Responsibility: from the server's deadlines in the viewer's roster row (`warnAt`, `outAt`,
 *                 absolute server times like the cooldown's end), once the warning point is
 *                 reached, one line in the warning colour with the whole seconds left, counting
 *                 down with the round view's ticker (../live/useTicker, `now` from
 *                 ../live/socket serverNow); a screen reader hears it once, at the warning point,
 *                 through a polite live region that keeps the first sentence while the visible
 *                 line counts on. Only a display: the server decides when the player is out.
 * Depends on:     react, @smg/contracts (InactivityView), ./roundText
 * Used by:        ./InputRow
 * Spec:           docs/spec/02-game-guess-the-number.md §5.3, §12
 */
import type { InactivityView } from '@smg/contracts';
import { useState, type ReactElement } from 'react';

import { inactivityText } from './roundText.js';

// The sentence the live region says, kept per warning point: set the first time a render finds
// the warning due, so the region does not change (and repeat) every second. A new deadline
// (the player guessed, the clock restarted) is a new warning point.
function useAnnouncement(inactivity: InactivityView | null, due: boolean, text: string): string {
  const [said, setSaid] = useState<{ readonly warnAt: number; readonly text: string } | null>(null);
  if (due && inactivity !== null && said?.warnAt !== inactivity.warnAt) {
    setSaid({ warnAt: inactivity.warnAt, text });
  }
  return due && said !== null ? `${said.text}.` : '';
}

export function InactivityLine(p: {
  readonly inactivity: InactivityView | null;
  readonly now: number;
}): ReactElement {
  const { inactivity } = p;
  const due = inactivity !== null && p.now >= inactivity.warnAt;
  const text = inactivity === null ? '' : inactivityText(inactivity.outAt, p.now);
  const announced = useAnnouncement(inactivity, due, text);
  return (
    <>
      {/* Always in the page, so the one sentence is announced when it appears. */}
      <p className="smg-visually-hidden" role="status" data-testid="inactivity-announcement">
        {announced}
      </p>
      {due ? (
        <p className="round-inactivity" data-testid="inactivity-warning">
          {text}
        </p>
      ) : null}
    </>
  );
}
