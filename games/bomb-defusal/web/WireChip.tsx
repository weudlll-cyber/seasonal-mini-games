/**
 * @file   games/bomb-defusal/web/WireChip.tsx
 * @module games/bomb-defusal/web
 * @brief  A wire as a chip (colour swatch and its name) and a sequence as numbered chips.
 *
 * Responsibility: every wire on a screen carries its name beside its swatch, so meaning never
 *                 rests on colour alone (02c §11); a harmless wire has a crossed, dimmed swatch
 *                 and a struck name, and says "harmless" to screen readers, so no word widens
 *                 a chip or button. The numbered list is the reveal of a sequence (02c §9);
 *                 the dots are a sequence in the result's history, as in the round's list.
 * Depends on:     react, @smg-game/bomb-defusal (types, wording), ./text (WIRE_COLORS), ./swatch.css
 * Used by:        ./panels, ./WireInput, ./ResultPanel
 * Spec:           docs/spec/02c-game-bomb-defusal.md §9, §11
 */
import { sequenceText, type Sequence, type Wire } from '@smg-game/bomb-defusal';
import type { ReactElement } from 'react';

import { WIRE_COLORS } from './text.js';
import './swatch.css';

// A wire's colour; a harmless wire's swatch is dimmed and crossed out (02c §11).
export function Swatch(p: { readonly wire: Wire; readonly crossed?: boolean }): ReactElement {
  const crossed = p.crossed === true;
  return (
    <span
      className="bd-swatch"
      data-wire={p.wire}
      data-crossed={crossed}
      aria-hidden="true"
      style={{ background: WIRE_COLORS[p.wire] }}
    >
      {crossed ? (
        <svg className="bd-cross" viewBox="0 0 10 10" focusable="false">
          <path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" />
        </svg>
      ) : null}
    </span>
  );
}

export function WireChip(p: { readonly wire: Wire; readonly harmless?: boolean }): ReactElement {
  const harmless = p.harmless === true;
  return (
    <span className="bd-chip" data-harmless={harmless}>
      <Swatch wire={p.wire} crossed={harmless} />
      <span className="bd-chip-name">{p.wire}</span>
      {harmless ? <span className="smg-visually-hidden"> harmless</span> : null}
    </span>
  );
}

// A sequence as the round's colour dots (the list's swatches, T143): its names read out and on
// hover, the same dots on the result's history (T150).
export function SequenceDots(p: { readonly sequence: Sequence }): ReactElement {
  const words = sequenceText(p.sequence);
  return (
    <span className="bd-dots" title={words}>
      {p.sequence.map((w, i) => (
        <Swatch key={i} wire={w} />
      ))}
      <span className="smg-visually-hidden">{words}</span>
    </span>
  );
}

export function SequenceChips(p: {
  readonly sequence: Sequence;
  readonly label: string;
  readonly testId?: string;
}): ReactElement {
  return (
    <ol className="bd-sequence" aria-label={p.label} data-testid={p.testId}>
      {p.sequence.map((w) => (
        <li key={w}>
          <WireChip wire={w} />
        </li>
      ))}
    </ol>
  );
}
