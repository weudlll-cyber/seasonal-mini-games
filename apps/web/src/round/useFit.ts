/**
 * @file   apps/web/src/round/useFit.ts
 * @module web/round
 * @brief  Fitting to the screen (O111): how many of a box's items fit.
 *
 * Responsibility: `useFit`: a box of a fixed height that never scrolls and never cuts an item
 *                 shows the items (`[data-fit]`) that fit whole and "+N more" for the rest (the
 *                 Others panel and line, O110). A screen's own scale is the kit's
 *                 `useFitScale('mini-games', …, { afterFonts: true })` (a game's own result
 *                 and, as `fit`, the start card and the result frame, ./ResultScreen,
 *                 ./RoundIntro): the kit fits again after web fonts load, which T404 needed
 *                 (the frame's option since v0.18.0, K55).
 * Depends on:     react
 * Used by:        ./OthersLine, ./RoundSide
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02-game-guess-the-number.md §12
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

// The items that fit whole: inside the box's height (and width) by half a pixel.
function fitting(box: HTMLElement): number {
  const b = box.getBoundingClientRect();
  const bottom = b.top + box.clientHeight + 0.5;
  const right = b.left + box.clientWidth + 0.5;
  let n = 0;
  for (const item of box.querySelectorAll('[data-fit]')) {
    const r = item.getBoundingClientRect();
    if (r.bottom > bottom || r.right > right) break;
    n += 1;
  }
  return n;
}

const overflows = (box: HTMLElement): boolean =>
  box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1;

// How many of the box's items show whole, the last place kept for "+N more" when some do not:
// with every item in the box (a pass laid out but never painted) count those inside it; fewer
// while the box overflows with the marker; a new size or new items (`signature`) count again.
export function useFit<T extends HTMLElement>(
  total: number,
  signature: string,
): { readonly ref: RefObject<T | null>; readonly shown: number } {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState('');
  const key = `${signature}|${size}|${String(total)}`;
  const [fit, setFit] = useState<{ readonly key: string; readonly shown: number } | null>(null);
  // Null while every item is in the box to be measured.
  const kept = fit !== null && fit.key === key ? fit.shown : null;
  useLayoutEffect(() => {
    const box = ref.current;
    if (box === null) return;
    if (kept === null) {
      const n = fitting(box);
      setFit({ key, shown: n >= total ? total : Math.max(0, n - 1) });
    } else if (kept > 0 && kept < total && overflows(box)) {
      setFit({ key, shown: kept - 1 });
    }
  });
  // A new size measures again.
  useLayoutEffect(() => {
    const box = ref.current;
    if (box === null || typeof ResizeObserver === 'undefined') return undefined;
    const watch = new ResizeObserver(() => {
      setSize(`${String(box.clientWidth)}x${String(box.clientHeight)}`);
    });
    watch.observe(box);
    return () => {
      watch.disconnect();
    };
  }, []);
  return { ref, shown: kept ?? total };
}
