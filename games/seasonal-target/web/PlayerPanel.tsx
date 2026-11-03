/**
 * @file   games/seasonal-target/web/PlayerPanel.tsx
 * @module games/seasonal-target/web
 * @brief  The player's panel in the info column: legend, area and hint, Fallen tiles; the line.
 *
 * Responsibility: the grid's companions for the whole round, top to bottom (O51): the heat
 *                 legend (./HeatLegend); the current target area once a halving has shrunk it
 *                 ("Target area: columns 6–15, rows 1–20", 02d §8.4); Spring Herald's quarter
 *                 as a highlighted "Free hint: …" line (02d §8.1, O35); in a Leaf Fall round the
 *                 Fallen tiles panel (./FallenCells, T115). The grid itself, with the selection,
 *                 belongs to the input (./TargetInput), because only the input can act. The
 *                 phone's info line says the halved area or the hint (`InfoLine`, T141).
 * Depends on:     react, @smg/game-sdk (props), @smg-game/seasonal-target (types),
 *                 ./FallenCells, ./HeatLegend, ./words
 * Used by:        ./index
 * Spec:           docs/spec/02d-game-seasonal-target.md §8, §11
 */
import type { Area, MapSize, PlayerView, Quarter } from '@smg-game/seasonal-target';
import type { PlayerPanelProps, SpectatorPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { FallenCells, leafFallOn } from './FallenCells.js';
import { HeatLegend } from './HeatLegend.js';
import { areaLine, freeHint } from './words.js';

const whole = (a: Area, map: MapSize): boolean =>
  a.left === 1 && a.top === 1 && a.right === map.width && a.bottom === map.height;

// The grid's lines: a shrunk area (or the caller's size line), and the hint. The whole grid's
// size is not repeated: the grid shows it.
export function GridLines(p: {
  readonly map: MapSize;
  readonly area: Area | null;
  readonly sizeLine: string | null;
  readonly hint: Quarter | null;
}): ReactElement {
  const areaText = p.area !== null && !whole(p.area, p.map) ? areaLine(p.area) : p.sizeLine;
  return (
    <>
      {areaText === null ? null : (
        <p className="st-area" data-testid="area-line">
          {areaText}
        </p>
      )}
      {p.hint === null ? null : (
        <p className="st-hint" data-testid="hint">
          {freeHint(p.hint)}
        </p>
      )}
    </>
  );
}

// The phone's info line (T141): the target area once a halving shrank it, else Spring's
// quarter ("Hint: south-east quarter"), else the heat legend; a spectator's view in
// individual mode has no area of its own.
export function InfoLine(props: SpectatorPanelProps): ReactElement {
  const v = props.view as Pick<PlayerView, 'map' | 'hint'> & { readonly area: Area | null };
  const shrunk = v.area !== null && !whole(v.area, v.map) ? areaLine(v.area) : null;
  const text = shrunk ?? (v.hint === null ? null : `Hint: ${v.hint.name} quarter`);
  return (
    <span className="st-line" data-testid="st-line">
      {text === null ? <HeatLegend /> : <strong>{text}</strong>}
    </span>
  );
}

export function PlayerPanel(props: PlayerPanelProps): ReactElement {
  const v = props.view as PlayerView;
  return (
    <div className="st-player" data-testid="st-player">
      <HeatLegend />
      <GridLines map={v.map} area={v.area} sizeLine={null} hint={v.hint} />
      {leafFallOn(props) ? <FallenCells fallen={v.fallen} /> : null}
    </div>
  );
}
