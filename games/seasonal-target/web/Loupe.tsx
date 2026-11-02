/**
 * @file   games/seasonal-target/web/Loupe.tsx
 * @module games/seasonal-target/web
 * @brief  The phone's loupe: about 5 × 5 tiles around a tap, large enough to hit, over the grid.
 *
 * Responsibility: on a phone whose tiles are smaller than a finger (./measure), the first tap
 *                 on the grid opens the loupe centred on it, clamped at the edges; its tiles are
 *                 at least 44 px with the same fills, numbers and marks (./TileGrid); a tap in
 *                 it selects that tile; the Column and Row fields and the arrow buttons
 *                 (./Steer) move the selection, the window following when it leaves; "Close",
 *                 Escape (`useDisclosure` of @smg/ui) or Guess close it (02d §11). The window
 *                 stays put while the selection is inside it, so a tile never jumps under the
 *                 finger.
 * Depends on:     react, @smg/ui (useDisclosure), @smg-game/seasonal-target (types, helpers),
 *                 ./Steer, ./TileGrid
 * Used by:        ./TargetInput
 * Spec:           docs/spec/02d-game-seasonal-target.md §11
 */
import { inArea, type Area, type Cell, type MapSize } from '@smg-game/seasonal-target';
import { useDisclosure } from '@smg/ui';
import { useState, type ReactElement } from 'react';

import { Steer } from './Steer.js';
import { TileGrid, type TileGridProps } from './TileGrid.js';

// Tiles per side of the loupe's window (the smallest grid has 8).
const SIDE = 5;

// One side's window of SIDE tiles around `at`, inside 1 … `size`.
function span(at: number, size: number): readonly [number, number] {
  const low = Math.min(Math.max(1, at - Math.floor(SIDE / 2)), Math.max(1, size - SIDE + 1));
  return [low, Math.min(size, low + SIDE - 1)];
}

function loupeWindow(c: Cell, map: MapSize): Area {
  const [left, right] = span(c.x, map.width);
  const [top, bottom] = span(c.y, map.height);
  return { left, right, top, bottom };
}

export function useLoupe(map: MapSize) {
  const sheet = useDisclosure();
  const [centre, setCentre] = useState<Cell>({ x: 1, y: 1 });
  const shown = loupeWindow(centre, map);
  return {
    sheet,
    shown,
    // The first tap: the window around it.
    show: (c: Cell): void => {
      setCentre(c);
      if (!sheet.open) sheet.toggle();
    },
    // A new selection: the window moves only once the selection leaves it.
    follow: (c: Cell): void => {
      if (!inArea(shown, c)) setCentre(c);
    },
  };
}

type LoupeState = ReturnType<typeof useLoupe>;

type GridParts = Pick<TileGridProps, 'map' | 'area' | 'quarter' | 'fallen' | 'tiles'>;

export function Loupe(p: {
  readonly loupe: LoupeState;
  readonly grid: GridParts;
  readonly selected: Cell;
  readonly pick: (c: Cell) => void;
}): ReactElement | null {
  const { sheet, shown } = p.loupe;
  if (!sheet.open) return null;
  return (
    <div
      id={sheet.panelId}
      className="st-loupe"
      role="dialog"
      aria-label="Loupe: tap a tile to select it"
      onKeyDown={sheet.onKeyDown}
      data-testid="loupe"
    >
      <TileGrid
        {...p.grid}
        shown={shown}
        variant="loupe"
        numbers
        selected={p.selected}
        label="Tiles around your tap"
        onTile={p.pick}
      />
      <div className="st-loupe-row">
        <Steer selected={p.selected} select={p.pick} />
        <button type="button" className="smg-btn st-loupe-close" onClick={sheet.close}>
          Close
        </button>
      </div>
    </div>
  );
}
