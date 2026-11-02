/**
 * @file   games/guess-the-number/web/FallenNumbers.tsx
 * @module games/guess-the-number/web
 * @brief  The "Fallen numbers" panel of a Leaf Fall round: every fallen number, ascending.
 *
 * Responsibility: in a round whose special is Leaf Fall, every number fallen so far as compact
 *                 chips that wrap, ascending as the view holds them, updated with every view;
 *                 its heading names the count. A "Fallen (N)" button beside the range opens it
 *                 as a sheet over the round (on a desktop at the right edge, over the guess
 *                 list's column, which keeps its rows that way, O46), closed by its Close
 *                 button, the same button again or Escape (03 §2.3, O37).
 *                 With the range hidden it is, with the list's rows, where the fallen numbers
 *                 are named (T54).
 * Depends on:     react, @smg/game-sdk (formatNumber, Season), @smg/ui (useDisclosure)
 * Used by:        ./PlayerPanel, ./SpectatorPanel
 * Spec:           docs/spec/03-seasonal-specials.md §2.3; docs/spec/02-game-guess-the-number.md §12
 */
import { formatNumber, type Season } from '@smg/game-sdk';
import { useDisclosure } from '@smg/ui';
import type { ReactElement } from 'react';

// The panel belongs to rounds where Leaf Fall is active: autumn with its special on.
export const leafFallOn = (p: { readonly season: Season; readonly specialOn: boolean }): boolean =>
  p.season === 'autumn' && p.specialOn;

export function FallenNumbers({ removed }: { readonly removed: readonly number[] }): ReactElement {
  const sheet = useDisclosure();
  const n = removed.length;
  return (
    <section
      className="gtn-fallen"
      aria-labelledby={`${sheet.panelId}-title`}
      data-open={sheet.open}
      data-testid="fallen-panel"
      onKeyDown={sheet.onKeyDown}
    >
      {/* A phone only: the panel lies behind this button. */}
      <button
        ref={sheet.button}
        type="button"
        className="smg-btn gtn-fallen-toggle"
        aria-expanded={sheet.open}
        aria-controls={sheet.panelId}
        onClick={sheet.toggle}
        data-testid="fallen-toggle"
      >
        Fallen ({n})
      </button>
      <div id={sheet.panelId} className="gtn-fallen-body">
        <div className="gtn-fallen-head">
          <h3 id={`${sheet.panelId}-title`} data-testid="fallen">
            Fallen numbers ({n})
          </h3>
          <button type="button" className="smg-btn gtn-fallen-close" onClick={sheet.close}>
            Close
          </button>
        </div>
        {n === 0 ? (
          <p className="gtn-range-note">None yet.</p>
        ) : (
          // The view's fallen numbers are ascending already (the state keeps them sorted).
          <ul className="gtn-fallen-list" data-testid="fallen-list">
            {removed.map((v) => (
              <li key={v}>{formatNumber(v)}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
