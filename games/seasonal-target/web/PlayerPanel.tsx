/**
 * @file   games/seasonal-target/web/PlayerPanel.tsx
 * @module games/seasonal-target/web
 * @brief  The player's main-area part: the hint and target-area lines, and the Fallen cells.
 *
 * Responsibility: the map's companion lines for the whole round: Spring Herald's quarter as a
 *                 highlighted "Free hint: …" line (02d §8.1, O35), the current target area
 *                 when a halving has shrunk it ("Target area: columns 13–37, rows 1–50",
 *                 02d §8.4), otherwise the map's size; in a Leaf Fall round the Fallen cells
 *                 panel (./FallenCells, T115). The map itself, with the selection, lives in the
 *                 input row (./TargetInput), because only the input row can act.
 * Depends on:     react, @smg/game-sdk (props), @smg-game/seasonal-target (types),
 *                 ./FallenCells, ./words
 * Used by:        ./index
 * Spec:           docs/spec/02d-game-seasonal-target.md §8, §11
 */
import type { Area, MapSize, PlayerView, Quarter } from '@smg-game/seasonal-target';
import type { PlayerPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { FallenCells, leafFallOn } from './FallenCells.js';
import { areaLine, freeHint, sizeText } from './words.js';

const whole = (a: Area, map: MapSize): boolean =>
  a.left === 1 && a.top === 1 && a.right === map.width && a.bottom === map.height;

// The lines above the map: the area (or the map's size) and the hint.
export function MapLines(p: {
  readonly map: MapSize;
  readonly area: Area | null;
  readonly sizeLine: string | null;
  readonly hint: Quarter | null;
}): ReactElement {
  const areaText =
    p.area !== null && !whole(p.area, p.map)
      ? areaLine(p.area)
      : (p.sizeLine ?? `Map: ${sizeText(p.map.width, p.map.height)}`);
  return (
    <>
      <p className="st-area" data-testid="area-line">
        {areaText}
      </p>
      {p.hint === null ? null : (
        <p className="st-hint" data-testid="hint">
          {freeHint(p.hint)}
        </p>
      )}
    </>
  );
}

export function PlayerPanel(props: PlayerPanelProps): ReactElement {
  const v = props.view as PlayerView;
  return (
    <div className="st-player" data-testid="st-player">
      <MapLines map={v.map} area={v.area} sizeLine={null} hint={v.hint} />
      {leafFallOn(props) ? <FallenCells fallen={v.fallen} /> : null}
    </div>
  );
}
