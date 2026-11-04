/**
 * @file   packages/ui/src/PlayerMark.tsx
 * @module ui
 * @brief  A player's marker shape in their colour, with their tag beside it ("p3", "you").
 *
 * Responsibility: the tag is what tells players apart (O62); the shape (filled dot, ring,
 *                 square) and the colour only support it. Decorative for a screen reader: the
 *                 row or tile around it names the player. `tag: false` draws the marker alone.
 * Depends on:     react, ./marks.css
 * Used by:        ./index, apps/web/src/round, games/seasonal-target/web
 * Spec:           docs/spec/02d-game-seasonal-target.md §11 (owner decision 62)
 */
import type { CSSProperties, ReactElement } from 'react';

import './marks.css';

export interface MarkView {
  readonly tag: string;
  readonly color: string;
  readonly shape: 'dot' | 'ring' | 'square';
}

export function PlayerMark(p: { readonly mark: MarkView; readonly tag?: boolean }): ReactElement {
  return (
    <span className="smg-mark" aria-hidden="true" data-testid="player-mark">
      <span
        className="smg-mark-shape"
        data-shape={p.mark.shape}
        style={{ '--mark': p.mark.color } as CSSProperties}
      />
      {p.tag === false ? null : <span className="smg-mark-tag">{p.mark.tag}</span>}
    </span>
  );
}
