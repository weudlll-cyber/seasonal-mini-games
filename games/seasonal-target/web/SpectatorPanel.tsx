/**
 * @file   games/seasonal-target/web/SpectatorPanel.tsx
 * @module games/seasonal-target/web
 * @brief  What a spectator sees in the main area: the tile grid with the guesses the view carries.
 *
 * Responsibility: in the round's stage, a flex column whose grid takes the free height (as
 *                 the input's, ./tiles.css); the shared target area (outside it dimmed) and
 *                 quarter (tinted); in individual mode only the size every area has, never
 *                 anyone's own area or quarter (02d §10); the grid (./TileGrid) with the tiles of shared
 *                 `numbers`/`full` (coloured by their answers under `full`, each with its
 *                 player's corner mark in their list colour and named on its label), the heat
 *                 legend, the fallen tiles hatched, and in a Leaf Fall round the Fallen tiles
 *                 panel. Nothing about a target, and nothing narrowed from the answers.
 * Depends on:     react, @smg/game-sdk (props), @smg-game/seasonal-target (types), ./FallenCells,
 *                 ./heat, ./HeatLegend, ./measure, ./PlayerPanel (GridLines), ./TileGrid, ./words
 * Used by:        ./index
 * Spec:           docs/spec/02d-game-seasonal-target.md §10
 */
import type { SpectatorView } from '@smg-game/seasonal-target';
import type { SpectatorPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { FallenCells, leafFallOn } from './FallenCells.js';
import { shotsOf, tilesOf } from './heat.js';
import { HeatLegend } from './HeatLegend.js';
import { readable, useTileSize } from './measure.js';
import { GridLines } from './PlayerPanel.js';
import { TileGrid } from './TileGrid.js';
import { sizeText } from './words.js';

export function SpectatorPanel(props: SpectatorPanelProps): ReactElement {
  const v = props.view as SpectatorView;
  const size = useTileSize(v.map.width);
  // Individual mode: the size of every target area once halving has shrunk them.
  const halved = v.areaSize.width !== v.map.width || v.areaSize.height !== v.map.height;
  const sizeLine =
    v.area === null && halved
      ? `Every target area: ${sizeText(v.areaSize.width, v.areaSize.height)}`
      : null;
  return (
    <div className="st-spectator" data-testid="st-spectator">
      <GridLines map={v.map} area={v.area} sizeLine={sizeLine} hint={v.hint} />
      <div className="st-board st-board--panel">
        <TileGrid
          map={v.map}
          area={v.area}
          quarter={v.hint}
          fallen={v.fallen}
          tiles={tilesOf(shotsOf([], v.log), props)}
          variant="board"
          numbers={readable(size.px)}
          gridRef={size.ref}
          label="The grid with the players' guesses."
        />
      </div>
      <HeatLegend mode={v.feedbackMode} />
      {leafFallOn(props) ? <FallenCells fallen={v.fallen} /> : null}
    </div>
  );
}
