/**
 * @file   games/guess-the-number/web/InfoLine.tsx
 * @module games/guess-the-number/web
 * @brief  The phone's info line of Guess The Number: the range, "Fallen N" and the hint.
 *
 * Responsibility: one line over the phone's guess list (T141): the range ("1–1,000" or "Any
 *                 whole number" while it is hidden), in a Leaf Fall round a "Fallen 10" chip,
 *                 and Spring Herald's hint in a few words ("Hint: ends in 7", in the season colour, O56), each part whole
 *                 (T150); the platform makes the line the button that opens the whole panel
 *                 as a sheet, which has the hint's sentence.
 *                 The player's and the spectator's views both carry these parts.
 * Depends on:     react, @smg/game-sdk (props, formatNumber), @smg-game/guess-the-number (types),
 *                 ./FallenNumbers, ./text
 * Used by:        ./index
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §2.3
 */
import type { SpectatorView } from '@smg-game/guess-the-number';
import { formatNumber, type SpectatorPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { leafFallOn } from './FallenNumbers.js';
import { shortHint } from './text.js';

export function InfoLine(props: SpectatorPanelProps): ReactElement {
  const v = props.view as Pick<SpectatorView, 'range' | 'removed' | 'hint'>;
  return (
    <span className="gtn-line" data-testid="gtn-line">
      <strong className="gtn-line-range">
        {v.range === null
          ? 'Any whole number'
          : `${formatNumber(v.range.low)}–${formatNumber(v.range.high)}`}
      </strong>
      {leafFallOn(props) ? (
        <span className="smg-chip gtn-line-chip">Fallen {formatNumber(v.removed.length)}</span>
      ) : null}
      {v.hint === null ? null : <span className="smg-chip smg-hint">{shortHint(v.hint)}</span>}
    </span>
  );
}
