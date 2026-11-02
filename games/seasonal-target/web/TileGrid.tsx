/**
 * @file   games/seasonal-target/web/TileGrid.tsx
 * @module games/seasonal-target/web
 * @brief  The grid of large heat-coloured tiles (O45), shared by the input, the loupe, the
 *         spectator and the result.
 *
 * Responsibility: one CSS grid of square tiles for the shown cells (the whole grid, or the
 *                 loupe's 5 × 5 window), always the whole grid: tiles outside the target area
 *                 dimmed, Spring's quarter tinted, fallen tiles hatched (a pattern, not colour
 *                 alone). A guessed tile is filled by its closest answer's step (./heat, from
 *                 the server's tier) and shows the distance with a small arrow (`direction`),
 *                 the distance (`distance`) or nothing (`closeness`), a target glyph when found;
 *                 the viewer's own tiles carry a frame, others' a corner mark in their list
 *                 colour, a pending own answer the frame with "…". Numbers are left out when
 *                 the tiles are too small to read (`numbers`). The selection is an outline
 *                 outside the tile, unlike the own frame inside it; the result's target a ring.
 *                 Each tile names its cell and every guess on it as title and label; the
 *                 interactive grid is one focus stop pointing at the selected tile
 *                 (`aria-activedescendant`), and a click or tap reports the tile; nothing here
 *                 sends anything (05 §3.1).
 * Depends on:     react, @smg/game-sdk (formatNumber), @smg-game/seasonal-target (types,
 *                 helpers), ./heat, ./words
 * Used by:        ./TargetInput, ./Loupe, ./SpectatorPanel, ./ResultPanel
 * Spec:           docs/spec/02d-game-seasonal-target.md §6, §8, §9, §11
 */
import {
  inArea,
  sameCell,
  type Area,
  type Cell,
  type MapSize,
  type Quarter,
} from '@smg-game/seasonal-target';
import { formatNumber } from '@smg/game-sdk';
import {
  useId,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type RefObject,
} from 'react';

import { NO_TILE, stepOf, tileKey, tileLabel, type Tile } from './heat.js';
import { ARROWS } from './words.js';

export interface TileGridProps {
  readonly map: MapSize;
  // The cells drawn: the whole grid, or the loupe's window.
  readonly shown?: Area;
  // The target area; tiles outside it are dimmed. Null: nothing is dimmed.
  readonly area: Area | null;
  readonly quarter: Quarter | null;
  readonly fallen: readonly Cell[];
  readonly tiles: ReadonlyMap<string, Tile>;
  readonly numbers: boolean;
  readonly label: string;
  // How the grid is sized (./tiles.css): filling its box (input, spectator), in the result
  // page's flow, or the loupe's large tiles.
  readonly variant: 'board' | 'flow' | 'loupe';
  readonly selected?: Cell | null;
  readonly target?: Cell | null;
  readonly gridRef?: RefObject<HTMLDivElement | null>;
  readonly onTile?: (cell: Cell) => void;
  readonly onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
}

const range = (low: number, high: number): number[] =>
  Array.from({ length: high - low + 1 }, (_, i) => low + i);

// What the tile says: the distance with the arrow, the distance, the found glyph, or "…".
function Face(p: { readonly tile: Tile; readonly numbers: boolean }) {
  const best = p.tile.best;
  if (best === null) {
    return p.tile.pending ? (
      <span className="st-face" aria-hidden="true">
        …
      </span>
    ) : null;
  }
  if (best.kind === 'correct') {
    return (
      <span className="st-face" aria-hidden="true">
        ◎
      </span>
    );
  }
  if (best.kind === 'closeness' || !p.numbers) return null;
  return (
    <span className="st-face" aria-hidden="true">
      {formatNumber(best.distance)}
      {best.kind === 'direction' ? <span className="st-dir">{ARROWS[best.direction]}</span> : null}
    </span>
  );
}

interface TileProps {
  readonly c: Cell;
  readonly id: string;
  readonly p: TileGridProps;
  readonly fallen: ReadonlySet<string>;
}

const covers = (a: Area | null | undefined, c: Cell): boolean => a != null && inArea(a, c);
const isAt = (at: Cell | null | undefined, c: Cell): boolean => at != null && sameCell(at, c);

// What one tile is: its guesses, fallen, outside the area, the target, and its words.
function factsOf({ c, p, fallen }: TileProps) {
  const tile = p.tiles.get(tileKey(c));
  const isFallen = fallen.has(tileKey(c));
  const out = p.area !== null && !inArea(p.area, c);
  const target = isAt(p.target, c);
  const notes = [
    target && 'the target',
    isFallen && 'fallen',
    out && 'outside the target area',
  ].filter((n): n is string => n !== false);
  const t = tile ?? NO_TILE;
  return { t, guessed: tile !== undefined, isFallen, out, target, label: tileLabel(c, t, notes) };
}

function TileCell(props: TileProps): ReactElement {
  const { c, id, p } = props;
  const { t, guessed, isFallen, out, target, label } = factsOf(props);
  return (
    <div
      id={id}
      role="gridcell"
      className="st-tile"
      title={label}
      aria-label={label}
      aria-selected={p.selected == null ? undefined : sameCell(p.selected, c)}
      // Read-only grids: a guessed tile is a focus stop of its own, to read its guesses.
      tabIndex={p.onKeyDown === undefined && guessed ? 0 : undefined}
      data-testid={p.variant === 'loupe' ? 'loupe-tile' : 'tile'}
      data-x={c.x}
      data-y={c.y}
      data-own={t.own}
      data-fallen={isFallen}
      data-step={t.best === null ? undefined : String(stepOf(t.best))}
      data-selected={isAt(p.selected, c)}
      data-pending={t.best === null && t.pending}
      data-out={out}
      data-quarter={covers(p.quarter, c)}
    >
      <Face tile={t} numbers={p.numbers} />
      {t.mark === null ? null : (
        <span className="st-mark" aria-hidden="true" style={{ background: t.mark }} />
      )}
      {target ? <span className="st-target" aria-hidden="true" data-testid="target-tile" /> : null}
    </div>
  );
}

// The tile under a click or tap, from its data attributes.
function cellAt(e: MouseEvent<HTMLDivElement>): Cell | null {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-x]');
  if (el === null) return null;
  return { x: Number(el.dataset['x']), y: Number(el.dataset['y']) };
}

export function TileGrid(p: TileGridProps): ReactElement {
  const uid = useId();
  const shown = p.shown ?? { left: 1, right: p.map.width, top: 1, bottom: p.map.height };
  const fallen = new Set(p.fallen.map(tileKey));
  const idOf = (c: Cell): string => `${uid}-${String(c.x)}-${String(c.y)}`;
  const cols = shown.right - shown.left + 1;
  const style = { '--st-cols': String(cols), '--st-rows': String(shown.bottom - shown.top + 1) };
  const interactive = p.onKeyDown !== undefined;
  return (
    <div
      ref={p.gridRef}
      className={`st-grid st-grid--${p.variant}`}
      style={style as CSSProperties}
      role="grid"
      aria-label={p.label}
      aria-readonly={p.onTile === undefined ? true : undefined}
      aria-activedescendant={interactive && p.selected != null ? idOf(p.selected) : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={p.onKeyDown}
      onClick={(e) => {
        const c = cellAt(e);
        if (c !== null) p.onTile?.(c);
      }}
      data-testid={p.variant === 'loupe' ? undefined : 'tile-grid'}
    >
      {range(shown.top, shown.bottom).map((y) => (
        <div key={y} role="row" className="st-gridrow">
          {range(shown.left, shown.right).map((x) => (
            <TileCell key={x} c={{ x, y }} id={idOf({ x, y })} p={p} fallen={fallen} />
          ))}
        </div>
      ))}
    </div>
  );
}
