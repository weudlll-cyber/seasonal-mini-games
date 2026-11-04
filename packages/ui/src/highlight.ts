/**
 * @file   packages/ui/src/highlight.ts
 * @module ui
 * @brief  The one player the round view highlights: from a list row, a tile or a tap.
 *
 * Responsibility: one shared value, a player key or null, so the platform's list and a game's
 *                 board highlight the same player without passing it through every component:
 *                 hovering or focusing a row or a tile sets it, leaving clears it, and a tap
 *                 on a phone keeps it for 3 s (O62). Components read it with `useHighlight`.
 * Depends on:     react
 * Used by:        ./index, apps/web/src/round/GuessLine, games/seasonal-target/web/TileGrid
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

// How an element of `key` shows under the highlight: 'on' for the player, 'off' for the rest
// while someone is highlighted, undefined when nobody is.
export function lit(highlighted: string | null, keys: readonly string[]): 'on' | 'off' | undefined {
  if (highlighted === null) return undefined;
  return keys.includes(highlighted) ? 'on' : 'off';
}
