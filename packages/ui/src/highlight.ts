/**
 * @file   packages/ui/src/highlight.ts
 * @module ui
 * @brief  The one player the round view highlights: from a list row, a tile or a tap.
 *
 * Responsibility: one shared value, a player key or null, so the platform's list and a game's
 *                 board highlight the same player without passing it through every component:
 *                 hovering or focusing a row or a tile sets it, leaving clears it, and a tap
 *                 on a phone keeps it for 3 s (O62). Components read it with `useHighlight`;
 *                 a list's row takes its part with `useHighlightRow` (T211).
 * Depends on:     react
 * Used by:        ./index, apps/web/src/round/GuessLine, apps/web/src/round/ResultParts,
 *                 games/seasonal-target/web/TileGrid
 * Spec:           docs/spec/02d-game-seasonal-target.md §11 (owner decision 62)
 */
import { useSyncExternalStore } from 'react';

let current: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export function setHighlight(key: string | null): void {
  clearTimeout(timer);
  if (key === current) return;
  current = key;
  for (const listener of listeners) listener();
}

// A tap on a phone: the player stays highlighted for `ms`, unless something else is meanwhile.
export function flashHighlight(key: string, ms = 3_000): void {
  setHighlight(key);
  timer = setTimeout(() => {
    if (current === key) setHighlight(null);
  }, ms);
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const read = (): string | null => current;

export const useHighlight = (): string | null => useSyncExternalStore(subscribe, read, read);

// A row of player `key` in the highlight (O62): hovering or focusing it highlights the player
// while that lasts, a tap on a phone for 3 s, and `data-hl` says whether it is the highlighted
// player's ('on') or another's ('off'). Null: a row outside the highlight, nothing set.
export function useHighlightRow(key: string | null, phone: boolean) {
  const highlighted = useHighlight();
  if (key === null) return {};
  const off = (): void => {
    setHighlight(null);
  };
  return {
    'data-hl': lit(highlighted, [key]),
    // Reachable by keyboard on a desktop; a phone's row is a tap target already.
    tabIndex: phone ? undefined : 0,
    onMouseEnter: () => {
      setHighlight(key);
    },
    onMouseLeave: off,
    onFocus: () => {
      setHighlight(key);
    },
    onBlur: off,
    onClick: phone
      ? () => {
          flashHighlight(key);
        }
      : undefined,
  };
}

// How an element of `key` shows under the highlight: 'on' for the player, 'off' for the rest
// while someone is highlighted, undefined when nobody is.
export function lit(highlighted: string | null, keys: readonly string[]): 'on' | 'off' | undefined {
  if (highlighted === null) return undefined;
  return keys.includes(highlighted) ? 'on' : 'off';
}
