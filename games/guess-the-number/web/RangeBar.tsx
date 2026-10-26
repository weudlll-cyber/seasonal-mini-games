/**
 * @file   games/guess-the-number/web/RangeBar.tsx
 * @module games/guess-the-number/web
 * @brief  The range bar: the current range, the narrowed band and the fallen numbers.
 *
 * Responsibility: one bar from the range's low to its high end with the band the server sent
 *                 highlighted (02 §12), fallen numbers struck as ticks (at most 200 drawn; the
 *                 count is always named), and the same facts as text for screen readers and
 *                 for colour-blind players. The client never computes the band.
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
  readonly range: RangeView;
  readonly band: RangeView | null;
  readonly removed: readonly number[];
  readonly label: string;
}

const MAX_TICKS = 200;

export function RangeBar({ range, band, removed, label }: RangeBarProps): ReactElement {
  const size = Math.max(1, range.high - range.low + 1);
  const at = (v: number) => `${String(((v - range.low) / size) * 100)}%`;
  const width = (r: RangeView) => `${String(((r.high - r.low + 1) / size) * 100)}%`;
  const narrowed = band !== null && (band.low !== range.low || band.high !== range.high);
  return (
    <figure className="gtn-range" aria-label={label}>
      <div className="gtn-range-bar" role="img" aria-hidden="true">
        {band === null ? null : (
          <span className="gtn-range-band" style={{ left: at(band.low), width: width(band) }} />
        )}
        {removed.slice(0, MAX_TICKS).map((v) => (
          <span key={v} className="gtn-range-fallen" style={{ left: at(v) }} />
        ))}
      </div>
      <figcaption className="gtn-range-text">
        <span>{range.low}</span>
        <span data-testid="band">
          {narrowed
            ? `Between ${String(band.low)} and ${String(band.high)}`
            : `${String(range.low)} to ${String(range.high)}`}
          {removed.length > 0 ? ` · ${String(removed.length)} fallen` : ''}
        </span>
        <span>{range.high}</span>
      </figcaption>
    </figure>
  );
}
