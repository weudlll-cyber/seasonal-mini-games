/**
 * @file   games/seasonal-target/web/readCursor.ts
 * @module games/seasonal-target/web
 * @brief  A read-only grid's keyboard: one focus stop, the arrow keys move between the tiles.
 *
 * Responsibility: the arrow keys' steps (shared with the running round's grid, ./TargetInput),
 *                 and for a read-only board (the result, the spectator's, a player's board
 *                 after they hit their target) one focus stop for the whole grid, as the
 *                 running round's grid is (owner decision of 2026-11-23 on OPEN (am), DECISIONS
 *                 O140): the arrow keys move a reading cursor, shown as the selection while the
 *                 grid has the focus, whose tile the grid points at (`aria-activedescendant`)
 *                 and whose player the highlight follows (./tileHighlight). It starts on the
 *                 target, else the first guessed tile, else the top left. The running grid
 *                 (its own keys) and the loupe (aimed with ./Steer) pass through unchanged.
 * Depends on:     react, @smg-game/seasonal-target (types), ./tileHighlight, ./TileGrid (props)
 * Used by:        ./TileGrid, ./TargetInput
 * Spec:           docs/spec/02d-game-seasonal-target.md §11
 */
import type { Area, Cell } from '@smg-game/seasonal-target';
import { useState, type FocusEvent, type KeyboardEvent } from 'react';

import { useTileHighlight } from './tileHighlight.js';
import type { TileGridProps } from './TileGrid.js';

export type Step = readonly [number, number];

export const STEPS: Readonly<Record<string, Step>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

// The read-only grid's name says how to move on it.
const HINT = 'Arrow keys move between the tiles.';

const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));

// Where the cursor starts: the target, else the first guessed tile in reading order (the
// tiles' keys are "x,y", ./heat tileKey), else the top left.
function startOf(p: TileGridProps, shown: Area): Cell {
  if (p.target != null) return p.target;
  const cells = [...p.tiles.keys()].map((k) => k.split(',').map(Number) as [number, number]);
  cells.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const [x, y] = cells[0] ?? [shown.left, shown.top];
  return { x, y };
}

// The grid's props with the reading cursor where it is read-only, and its focus handlers
// (the highlight's with the cursor's focus).
export function useGridKeys(props: TileGridProps, shown: Area) {
  const [cursor, setCursor] = useState<Cell | null>(null);
  const [focused, setFocused] = useState(false);
  const reading = props.onKeyDown === undefined && props.variant === 'board';
  const at = cursor ?? startOf(props, shown);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const step = STEPS[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const x = clamp(at.x + step[0], shown.left, shown.right);
    setCursor({ x, y: clamp(at.y + step[1], shown.top, shown.bottom) });
  };
  // The cursor shows as the selection only while the grid has the focus.
  const p: TileGridProps = reading
    ? { ...props, onKeyDown, selected: focused ? at : null, label: `${props.label} ${HINT}` }
    : props;
  const highlight = useTileHighlight(p);
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    setFocused(true);
    highlight.onFocus(e);
  };
  const onBlur = () => {
    setFocused(false);
    highlight.onBlur();
  };
  return { p, handlers: { ...highlight, onFocus, onBlur } };
}
