/**
 * @file   apps/web/src/live/useTicker.ts
 * @module web/live
 * @brief  Re-render a few times a second while something on screen counts down.
 *
 * Responsibility: the cooldown ring, time left and "answer arriving in 2 s" read the server
 *                 clock (./socket serverNow) on each render; this hook only asks for those
 *                 renders, four a second and only while `active`. The countdowns to a round's
 *                 opening are the kit's (useCountdown, the start card's `opensAt`). Adapted
 *                 from Bingo's useSecondsUntil.ts.
 * Depends on:     react
 * Used by:        ../round/RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §7 (the ring is only a display)
 */
import { useEffect, useState } from 'react';

const EVERY_MS = 250;

export function useTicker(active: boolean): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => {
      setTick((t) => t + 1);
    }, EVERY_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [active]);
  return tick;
}
