/**
 * @file   games/seasonal-target/web/SpectatorPanel.tsx
 * @module games/seasonal-target/web
 * @brief  What a spectator sees in the main area: the map with the dots the view carries.
 *
 * Responsibility: the shared target area and quarter (individual mode: only the size every
 *                 area has, never anyone's own area or quarter, 02d §10), the map with the dots
 *                 of shared `numbers`/`full` (arrows under `full` and `direction`), named by
 *                 the players' names, the fallen cells, and in a Leaf Fall round the Fallen
 *                 cells panel. Nothing about a target, and nothing narrowed from the answers.
 * Depends on:     react, @smg/game-sdk (props), @smg-game/seasonal-target (types), ./dots,
 *                 ./FallenCells, ./MapBoard, ./PlayerPanel (MapLines), ./words
 * Used by:        ./index
 * Spec:           docs/spec/02d-game-seasonal-target.md §10
 */
import type { SpectatorView } from '@smg-game/seasonal-target';
import type { SpectatorPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { dotsOf } from './dots.js';
import { FallenCells, leafFallOn } from './FallenCells.js';
import { MapBoard } from './MapBoard.js';
import { MapLines } from './PlayerPanel.js';
import { sizeText } from './words.js';

export function SpectatorPanel(props: SpectatorPanelProps): ReactElement {
  const v = props.view as SpectatorView;
  const shown = v.area ?? { left: 1, right: v.map.width, top: 1, bottom: v.map.height };
  // Individual mode: the size of every target area once halving has shrunk them.
  const halved = v.areaSize.width !== v.map.width || v.areaSize.height !== v.map.height;
  const sizeLine =
    v.area === null && halved
      ? `Every target area: ${sizeText(v.areaSize.width, v.areaSize.height)}`
      : null;
  return (
    <div className="st-spectator" data-testid="st-spectator">
      <MapLines map={v.map} area={v.area} sizeLine={sizeLine} hint={v.hint} />
      <MapBoard
        shown={shown}
        dots={dotsOf([], v.log, props.names)}
        fallen={v.fallen}
        quarter={v.hint}
        label="The map with the players' guesses."
      />
      {leafFallOn(props) ? <FallenCells fallen={v.fallen} /> : null}
    </div>
  );
}
