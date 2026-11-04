/**
 * @file   games/seasonal-target/web/tileHighlight.ts
 * @module games/seasonal-target/web
 * @brief  The grid's part in the highlighted player (O62): who a tile names, what lights up.
 *
 * Responsibility: a guessed tile's corner mark (its first guesser's tag and marker, from 20 px
 *                 up; the highlighted player's where they guessed it too) and whether it is the highlighted player's ('on') or another's ('off');
 *                 hovering or focusing a tile highlights its first guesser, and on the board
 *                 so does moving the selection while the grid has the focus (@smg/ui
 *                 `setHighlight`); leaving clears it.
 * Depends on:     react, @smg/ui (highlight), ./heat, ./TileGrid (props)
 * Used by:        ./TileGrid
 * Spec:           docs/spec/02d-game-seasonal-target.md §11
 */
import { lit, setHighlight } from '@smg/ui';
import { useEffect, useState, type FocusEvent, type MouseEvent } from 'react';

import { OWN, tileKey, type Tile } from './heat.js';
import { YOU_MARK } from './players.js';
import type { TileGridProps } from './TileGrid.js';

// The viewer's own tiles without a key of theirs still say "you".
const ownMark = (key: string) => (key === OWN ? YOU_MARK : undefined);

// The tile's corner mark and its state under the highlight.
export function playerFacts(t: Tile, guessed: boolean, p: TileGridProps, hl: string | null) {
  // A highlighted player's own tile names them, though another guessed it first.
  const first = hl !== null && t.who.includes(hl) ? hl : t.who[0];
  return {
    mark: first === undefined || !p.tags ? undefined : (p.marks[first] ?? ownMark(first)),
    lit: guessed ? lit(hl, t.who) : undefined,
  };
}

// The first guesser of the tile an event is on, or null for an empty tile.
const whoAt = (target: EventTarget): string | null =>
  (target as HTMLElement).closest<HTMLElement>('[data-who]')?.dataset['who']?.split(' ')[0] ?? null;

// The grid's handlers for the highlight: hovering or focusing a tile highlights its player; on the
// board, so does moving the selection while the grid has the focus.
export function useTileHighlight(p: TileGridProps) {
  const [focused, setFocused] = useState(false);
  const selectedWho =
    p.selected == null ? null : (p.tiles.get(tileKey(p.selected))?.who[0] ?? null);
  useEffect(() => {
    if (focused && p.onKeyDown !== undefined) setHighlight(selectedWho);
  }, [focused, selectedWho, p.onKeyDown]);
  return {
    onMouseOver: (e: MouseEvent<HTMLDivElement>) => {
      setHighlight(whoAt(e.target));
    },
    onMouseLeave: () => {
      setHighlight(null);
    },
    onFocus: (e: FocusEvent<HTMLDivElement>) => {
      setFocused(true);
      if (p.onKeyDown === undefined) setHighlight(whoAt(e.target));
    },
    onBlur: () => {
      setFocused(false);
      setHighlight(null);
    },
  };
}
