/**
 * @file   games/seasonal-target/web/FallenCells.tsx
 * @module games/seasonal-target/web
 * @brief  The "Fallen cells" panel of a Leaf Fall round: every fallen cell in words.
 *
 * Responsibility: in a round whose special is Leaf Fall, every fallen cell the view carries as
 *                 compact chips "(12, 34)", row by row as the state keeps them, with the count
 *                 in its heading; on a desktop a short box that scrolls inside itself, on a
 *                 phone a "Fallen (N)" button that opens it as a sheet, closed by Close, the
 *                 button or Escape (T115). The grid shows the same tiles hatched.
 * Depends on:     react, @smg/game-sdk (Season), @smg/ui (useDisclosure),
 *                 @smg-game/seasonal-target (types), ./words, ./fallen.css
 * Used by:        ./PlayerPanel, ./SpectatorPanel
 * Spec:           docs/spec/02d-game-seasonal-target.md §8.3, §11; docs/spec/03-seasonal-specials.md §2.3
 */
import type { Cell } from '@smg-game/seasonal-target';
import type { Season } from '@smg/game-sdk';
import { useDisclosure } from '@smg/ui';
import type { ReactElement } from 'react';

import { cellText } from './words.js';
import './fallen.css';

// The panel belongs to rounds where Leaf Fall is active: autumn with its special on.
export const leafFallOn = (p: { readonly season: Season; readonly specialOn: boolean }): boolean =>
  p.season === 'autumn' && p.specialOn;

export function FallenCells({ fallen }: { readonly fallen: readonly Cell[] }): ReactElement {
  const sheet = useDisclosure();
  const n = fallen.length;
  return (
    <section
      className="st-fallen"
      aria-labelledby={`${sheet.panelId}-title`}
      data-open={sheet.open}
      data-testid="fallen-panel"
      onKeyDown={sheet.onKeyDown}
    >
      <button
        ref={sheet.button}
        type="button"
        className="smg-btn st-fallen-toggle"
        aria-expanded={sheet.open}
        aria-controls={sheet.panelId}
        onClick={sheet.toggle}
        data-testid="fallen-toggle"
      >
        Fallen ({n})
      </button>
      <div id={sheet.panelId} className="st-fallen-body">
        <div className="st-fallen-head">
          <h3 id={`${sheet.panelId}-title`} data-testid="fallen">
            Fallen cells ({n})
          </h3>
          <button type="button" className="smg-btn st-fallen-close" onClick={sheet.close}>
            Close
          </button>
        </div>
        {n === 0 ? (
          <p className="st-note">None yet.</p>
        ) : (
          <ul className="st-fallen-list" data-testid="fallen-list">
            {fallen.map((c) => (
              <li key={`${String(c.x)}-${String(c.y)}`}>{cellText(c)}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
