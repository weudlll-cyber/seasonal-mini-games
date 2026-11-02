/**
 * @file   games/seasonal-target/web/measure.ts
 * @module games/seasonal-target/web
 * @brief  React hooks: how large a grid's tiles are drawn, and whether the screen is a phone's.
 *
 * Responsibility: `useTileSize` measures a grid's width with a ResizeObserver and divides it by
 *                 its columns, so a tile too small to read its number leaves it out (the
 *                 tooltip and the loupe still give it) and a phone knows when to open the loupe
 *                 (02d §11); `useCompact` follows the phone media query (narrow viewport under
 *                 900 px or a coarse pointer). Both are guarded for environments without the
 *                 API (jsdom in tests): the size is then unknown (null) and the screen not
 *                 compact, so every tile shows its number and a tap selects directly.
 * Depends on:     react
 * Used by:        ./TargetInput, ./SpectatorPanel, ./ResultPanel
 * Spec:           docs/spec/02d-game-seasonal-target.md §6, §11
 */
import { useEffect, useRef, useState, type RefObject } from 'react';

// The smallest tile, in CSS pixels, whose number is still drawn (about 10 px digits).
const READABLE_PX = 24;
// The smallest tile a finger hits reliably (the platform's hit target).
export const TOUCH_PX = 44;

const COMPACT = '(max-width: 899px), (pointer: coarse)';

interface TileSize {
  readonly ref: RefObject<HTMLDivElement | null>;
  // One tile's width in CSS pixels, or null while unmeasured.
  readonly px: number | null;
}

export function useTileSize(columns: number): TileSize {
  const ref = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState<number | null>(null);
  useEffect(() => {
    const grid = ref.current;
    if (grid === null || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setPx(width / columns);
    });
    observer.observe(grid);
    return () => {
      observer.disconnect();
    };
  }, [columns]);
  return { ref, px };
}

// Whether numbers fit on the tiles: unknown sizes count as readable.
export const readable = (px: number | null): boolean => px === null || px >= READABLE_PX;

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
