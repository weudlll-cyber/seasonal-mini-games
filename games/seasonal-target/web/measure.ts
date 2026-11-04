/**
 * @file   games/seasonal-target/web/measure.ts
 * @module games/seasonal-target/web
 * @brief  React hooks: how large a grid's tiles are drawn, and whether the screen is a phone's.
 *
 * Responsibility: `useTileSize` measures a grid wherever it is drawn (the round's stage, the
 *                 spectator's or the result's box) with a ResizeObserver and turns its content
 *                 width into one tile's width, so a tile under `NUMBER_MIN_PX` leaves its number
 *                 out (the tooltip and the loupe still give it, O51) and a phone knows when to
 *                 open the loupe (02d §11); `useCompact` follows the phone media query (narrow
 *                 viewport under 900 px or a coarse pointer). Both are guarded for environments
 *                 without the API (jsdom in tests): the size is then unknown (null) and the
 *                 screen not compact, so every tile shows its number and a tap selects directly.
 * Depends on:     react
 * Used by:        ./TargetInput, ./SpectatorPanel, ./ResultPanel
 * Spec:           docs/spec/02d-game-seasonal-target.md §6, §11
 */
import { useEffect, useState } from 'react';

// The smallest tile, in CSS pixels, whose number is still drawn (O51): below it a tile shows
// its colour and marks only.
export const NUMBER_MIN_PX = 20;
// The smallest tile a finger hits reliably (the platform's hit target).
export const TOUCH_PX = 44;
// The gap between two tiles, as `.st-grid` in ./tiles.css.
const GAP_PX = 2;

const COMPACT = '(max-width: 899px), (pointer: coarse)';

interface TileSize {
  // A callback ref: the grid may mount later, or move into the stage through a portal.
  readonly ref: (el: HTMLDivElement | null) => void;
  // One tile's width in CSS pixels, or null while unmeasured.
  readonly px: number | null;
}

// One tile of `columns` in a grid whose content box (inside its padding) is `width` wide.
const tileWidth = (width: number, columns: number): number =>
  (width - (columns - 1) * GAP_PX) / columns;

export function useTileSize(columns: number): TileSize {
  const [grid, setGrid] = useState<HTMLDivElement | null>(null);
  const [px, setPx] = useState<number | null>(null);
  useEffect(() => {
    if (grid === null || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setPx(tileWidth(width, columns));
    });
    observer.observe(grid);
    return () => {
      observer.disconnect();
    };
  }, [grid, columns]);
  return { ref: setGrid, px };
}

// Whether numbers fit on the tiles: unknown sizes count as readable.
export const readable = (px: number | null): boolean => px === null || px >= NUMBER_MIN_PX;

const compactQuery = (): MediaQueryList | null =>
  typeof window.matchMedia === 'function' ? window.matchMedia(COMPACT) : null;

export function useCompact(): boolean {
  const [compact, setCompact] = useState(() => compactQuery()?.matches ?? false);
  useEffect(() => {
    const query = compactQuery();
    if (query === null) return undefined;
    const change = (e: MediaQueryListEvent): void => {
      setCompact(e.matches);
    };
    query.addEventListener('change', change);
    return () => {
      query.removeEventListener('change', change);
    };
  }, []);
  return compact;
}
