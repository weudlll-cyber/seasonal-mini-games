/**
 * @file   packages/ui/src/SignToggle.tsx
 * @module ui
 * @brief  The ± button that flips the sign of a typed number (DECISIONS T57).
 *
 * Responsibility: `flipSign` puts a minus in front of the text or takes it away; `SignToggle`
 *                 is the square button beside a number field where negative numbers are
 *                 allowed, since many phone keypads have no minus key. The field owns its text
 *                 and decides what the flipped text means.
 * Depends on:     react
 * Used by:        ./index; apps/web/src/components/fields (NumberField),
 *                 games/guess-the-number/web/PlayerPanel (GuessInput)
 * Spec:           docs/spec/02-game-guess-the-number.md §12; DECISIONS T57
 */
import type { ReactElement } from 'react';

// "-500" ↔ "500"; an empty field becomes "-", ready for the digits.
export function flipSign(text: string): string {
  return text.startsWith('-') ? text.slice(1) : `-${text}`;
}

export function SignToggle(p: {
  // The button's accessible name; a form with several fields names the field in it.
  readonly label: string;
  readonly onFlip: () => void;
}): ReactElement {
  return (
    <button type="button" className="smg-btn smg-sign" onClick={p.onFlip} aria-label={p.label}>
      ±
    </button>
  );
}
