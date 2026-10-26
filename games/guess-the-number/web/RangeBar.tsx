/**
 * @file   games/guess-the-number/web/RangeBar.tsx
 * @module games/guess-the-number/web
 * @brief  The range block: where the number is, the bar and the fallen numbers.
 *
 * Responsibility: "The number is somewhere between L and H" in large type and a full-width
 *                 bar from L to H on which fallen numbers show as gaps (at most 200 drawn; the
 *                 count is always named under it); with a hidden range "Any whole number" and
 *                 a note that negative numbers are possible (O19). Nothing narrowed from the
 *                 answers is drawn (O17). The same facts are text for screen readers.
 * Depends on:     react
 * Used by:        ./PlayerPanel, ./SpectatorPanel
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §2.3, §4
 */
import type { ReactElement } from 'react';

interface RangeView {
  readonly low: number;
  readonly high: number;
}

interface RangeBarProps {
  // Null while the range is hidden.
  readonly range: RangeView | null;
  readonly removed: readonly number[];
}

const MAX_GAPS = 200;

export function RangeBar({ range, removed }: RangeBarProps): ReactElement {
  if (range === null) {
    return (
      <section className="gtn-range" aria-label="The range" data-testid="range">
        <p className="gtn-range-title">Any whole number</p>
        <p className="gtn-range-note">The range is hidden. Negative numbers are possible.</p>
      </section>
    );
  }
  const size = Math.max(1, range.high - range.low + 1);
  const at = (v: number) => `${String(((v - range.low) / size) * 100)}%`;
  return (
    <section className="gtn-range" aria-label="The range" data-testid="range">
      <p className="gtn-range-title">
        The number is somewhere between {range.low} and {range.high}
      </p>
      <div className="gtn-range-bar" aria-hidden="true">
        {removed.slice(0, MAX_GAPS).map((v) => (
          <span key={v} className="gtn-range-gap" style={{ left: at(v) }} />
        ))}
      </div>
      {removed.length === 0 ? null : (
        <p className="gtn-range-note" data-testid="fallen">
          {removed.length} {removed.length === 1 ? 'number has' : 'numbers have'} fallen.
        </p>
      )}
    </section>
  );
}
