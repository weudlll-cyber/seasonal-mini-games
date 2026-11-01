/**
 * @file   games/seasonal-target/web/Legend.tsx
 * @module games/seasonal-target/web
 * @brief  The map's small legend: each player with a dot, their colour swatch and name.
 *
 * Responsibility: one entry per player whose dots the map shows (./dots `legendOf`), the
 *                 viewer's first as "You" with the ring own dots carry; nothing when the map
 *                 has no dots. Names are always written out, so colour is never alone; on a
 *                 phone the legend is left out for space (./st.css), the dots still name their
 *                 player on focus or hover.
 * Depends on:     react, ./dots
 * Used by:        ./TargetInput, ./SpectatorPanel, ./ResultPanel
 * Spec:           docs/spec/02d-game-seasonal-target.md §6
 */
import type { ReactElement } from 'react';

import { legendOf, type Dot } from './dots.js';

export function Legend({ dots }: { readonly dots: readonly Dot[] }): ReactElement | null {
  const entries = legendOf(dots);
  if (entries.length === 0) return null;
  return (
    <ul className="st-legend" aria-label="Players on the map" data-testid="map-legend">
      {entries.map((e) => (
        <li key={e.name} data-own={e.own}>
          <span className="st-swatch" aria-hidden="true" style={{ background: e.color }} />
          {e.name}
        </li>
      ))}
    </ul>
  );
}
