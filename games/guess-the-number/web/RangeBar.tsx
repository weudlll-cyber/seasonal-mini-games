/**
 * @file   games/guess-the-number/web/RangeBar.tsx
 * @module games/guess-the-number/web
 * @brief  The range block: where the number is, and the bar in the season colour.
 *
 * Responsibility: "The number is somewhere between L and H" in large type, the two numbers
 *                 never split over two lines, and a full-width bar from L to H in the season
 *                 colour (the fallen numbers are listed under it, ./FallenNumbers, O58). With
 *                 a hidden range "Any whole number" and a note that negative numbers are
 *                 possible (O19). Nothing narrowed from the answers is drawn (O17).
 * Depends on:     react, @smg/game-sdk (formatNumber)
 * Used by:        ./PlayerPanel, ./SpectatorPanel
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §4
 */
import { formatNumber } from '@smg/game-sdk';
import type { ReactElement } from 'react';

interface RangeView {
  readonly low: number;
  readonly high: number;
}

export function RangeBar({ range }: { readonly range: RangeView | null }): ReactElement {
  if (range === null) {
    return (
      <section className="gtn-range" aria-label="The range" data-testid="range">
        <p className="gtn-range-title">Any whole number</p>
        <p className="gtn-range-note">The range is hidden. Negative numbers are possible.</p>
      </section>
    );
  }
  return (
    <section className="gtn-range" aria-label="The range" data-testid="range">
      <p className="gtn-range-title">
        The number is somewhere between{' '}
        <span className="gtn-nowrap">
          {formatNumber(range.low)} and {formatNumber(range.high)}
        </span>
      </p>
      <div className="gtn-range-bar" aria-hidden="true" />
    </section>
  );
}
