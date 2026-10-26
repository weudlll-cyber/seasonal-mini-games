/**
 * @file   apps/web/src/live/useTicker.ts
 * @module web/live
 * @brief  Re-render a few times a second while something on screen counts down.
 *
 * Responsibility: the countdown to the open, the cooldown ring, time left and "answer arriving
 *                 in 2 s" read the server clock (./socket serverNow) on each render; this
 *                 hook only asks for those renders, and only while `active`. Adapted from
 *                 Bingo's useSecondsUntil.ts.
 * Depends on:     react
 * Used by:        ../round/RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §7 (the ring is only a display)
 */
import { useEffect, useState } from 'react';

export function useTicker(active: boolean, everyMs = 250): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => {
      setTick((t) => t + 1);
    }, everyMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [active, everyMs]);
  return tick;
}
