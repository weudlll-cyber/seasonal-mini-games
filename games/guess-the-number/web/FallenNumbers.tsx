/**
 * @file   games/guess-the-number/web/FallenNumbers.tsx
 * @module games/guess-the-number/web
 * @brief  The fallen numbers of a Leaf Fall round, listed in the game panel (O58).
 *
 * Responsibility: in a round whose special is Leaf Fall, the heading "Fallen numbers (N)" and
 *                 the fallen numbers as plain chips, ascending as the view holds them, right in
 *                 the panel without opening anything. On a desktop the list keeps three rows;
 *                 as many numbers as fit there show, then "+N more" opens every one as a sheet
 *                 (closed by Close, the button again or Escape). In the phone's sheet the list
 *                 has no row limit, so all show. With the range hidden it is, with the list's
 *                 rows, where the fallen numbers are named (T54).
 * Depends on:     react, @smg/game-sdk (formatNumber, Season), @smg/ui (useDisclosure, useFit)
 * Used by:        ./PlayerPanel, ./SpectatorPanel
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §2.3
 */
import { formatNumber, type Season } from '@smg/game-sdk';
import { useDisclosure, useFit } from '@smg/ui';
import type { ReactElement } from 'react';

// The panel belongs to rounds where Leaf Fall is active: autumn with its special on.
export const leafFallOn = (p: { readonly season: Season; readonly specialOn: boolean }): boolean =>
  p.season === 'autumn' && p.specialOn;

// The numbers as chips: readable digits with thousands separators, nothing struck through.
function Chips({ removed }: { readonly removed: readonly number[] }) {
  return removed.map((v) => <li key={v}>{formatNumber(v)}</li>);
}

export function FallenNumbers({ removed }: { readonly removed: readonly number[] }): ReactElement {
  const sheet = useDisclosure();
  const { ref, fit } = useFit<HTMLUListElement>(removed.length);
  const n = removed.length;
  const more = n - fit;
  return (
    <section
      className="gtn-fallen"
      aria-labelledby={`${sheet.panelId}-title`}
      data-open={sheet.open}
      data-testid="fallen-panel"
      onKeyDown={sheet.onKeyDown}
    >
      <h3 id={`${sheet.panelId}-title`} className="gtn-fallen-title" data-testid="fallen">
        Fallen numbers ({formatNumber(n)})
      </h3>
      {n === 0 ? (
        <p className="gtn-range-note">None yet.</p>
      ) : (
        // The view's fallen numbers are ascending already (the state keeps them sorted).
        <ul ref={ref} className="gtn-fallen-list" data-testid="fallen-list">
          <Chips removed={removed} />
        </ul>
      )}
      {more <= 0 ? null : (
        <button
          ref={sheet.button}
          type="button"
          className="smg-btn gtn-fallen-more"
          aria-expanded={sheet.open}
          aria-controls={sheet.panelId}
          onClick={sheet.toggle}
          data-testid="fallen-more"
        >
          +{formatNumber(more)} more
        </button>
      )}
      <div id={sheet.panelId} className="gtn-fallen-body" hidden={!sheet.open}>
        <div className="gtn-fallen-head">
          <h3>Fallen numbers ({formatNumber(n)})</h3>
          <button type="button" className="smg-btn gtn-fallen-close" onClick={sheet.close}>
            Close
          </button>
        </div>
        <ul className="gtn-fallen-list gtn-fallen-list--all" data-testid="fallen-all">
          <Chips removed={removed} />
        </ul>
      </div>
    </section>
  );
}
