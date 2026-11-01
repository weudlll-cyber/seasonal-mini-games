/**
 * @file   games/guess-the-number/web/RangeBar.tsx
 * @module games/guess-the-number/web
 * @brief  The range block: where the number is, the bar and the fallen numbers.
 *
 * Responsibility: "The number is somewhere between L and H" in large type, the two numbers
 *                 never split over two lines, and a full-width bar from L to H on which fallen
 *                 numbers show as gaps (the Fallen numbers panel beside it names them all,
 *                 ./FallenNumbers): each gap covers its numbers' share of the bar, at least
 *                 4 px wide, in the dark colour that stands out on every season colour, so
 *                 even one fallen number is seen (O35). Fallen numbers closer together than
 *                 about 5 px of a phone's bar merge into one segment, solid where every
 *                 number in it fell and hatched where some did not, so many falls still read
 *                 as a bar with holes, not a black block. With a hidden range "Any whole
 *                 number" and a note that negative numbers are possible (O19). Nothing
 *                 narrowed from the answers is drawn (O17).
 * Depends on:     react, @smg/game-sdk (formatNumber)
 * Used by:        ./PlayerPanel, ./SpectatorPanel
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §2.3, §4
 */
import { formatNumber } from '@smg/game-sdk';
import type { CSSProperties, ReactElement } from 'react';

interface RangeView {
  readonly low: number;
  readonly high: number;
}

interface RangeBarProps {
  // Null while the range is hidden.
  readonly range: RangeView | null;
  readonly removed: readonly number[];
}

// Fallen numbers this share of the bar apart or closer merge: about 5 px of a 360 px phone.
const MERGE_PERCENT = 1.5;

// A run of fallen numbers drawn as one gap, from `from` to `to`, holding `count` of them.
interface Segment {
  readonly from: number;
  readonly to: number;
  readonly count: number;
}

// The fallen numbers inside the range, ascending, merged where their neighbours are close.
function segmentsOf(removed: readonly number[], range: RangeView, size: number): Segment[] {
  const reach = (size * MERGE_PERCENT) / 100;
  const inside = removed.filter((v) => v >= range.low && v <= range.high).sort((a, b) => a - b);
  const out: Segment[] = [];
  for (const v of inside) {
    const last = out.at(-1);
    if (last !== undefined && v - last.to <= reach) {
      out[out.length - 1] = { from: last.from, to: v, count: last.count + 1 };
    } else {
      out.push({ from: v, to: v, count: 1 });
    }
  }
  return out;
}

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
  const percent = (n: number) => `${String((n * 100) / size)}%`;
  // Centred on the middle of its numbers' share of the bar, as wide as that share (./gtn.css);
  // hatched when it holds numbers that did not fall.
  const gap = ({ from, to, count }: Segment) => (
    <span
      key={from}
      className={count < to - from + 1 ? 'gtn-range-gap gtn-range-gap--merged' : 'gtn-range-gap'}
      style={
        {
          left: percent((from + to + 1) / 2 - range.low),
          '--gtn-span': percent(to - from + 1),
        } as CSSProperties
      }
      data-testid="range-gap"
    />
  );
  return (
    <section className="gtn-range" aria-label="The range" data-testid="range">
      <p className="gtn-range-title">
        The number is somewhere between{' '}
        <span className="gtn-nowrap">
          {formatNumber(range.low)} and {formatNumber(range.high)}
        </span>
      </p>
      <div className="gtn-range-bar" aria-hidden="true">
        {segmentsOf(removed, range, size).map(gap)}
      </div>
    </section>
  );
}
