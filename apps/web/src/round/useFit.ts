/**
 * @file   apps/web/src/round/useFit.ts
 * @module web/round
 * @brief  How many of a box's items fit it whole, so the rest go behind "+N more" (O110).
 *
 * Responsibility: a box of a fixed height that never scrolls and never cuts an item (the
 *                 owner's no-clipping rule of RD-2): with every item in it (a pass the browser
 *                 lays out but never paints, a layout effect runs before the paint), count the
 *                 items (`[data-fit]`) whose box lies inside the box's own; when some do not,
 *                 keep one fewer, so the "+N more" marker takes the last place, and fewer still
 *                 while the box overflows with the marker. A new size of the box or new items
 *                 (`signature`) measure again.
 * Depends on:     react
 * Used by:        ./OthersLine, ./RoundSide (OthersPanel)
 * Spec:           docs/spec/02-game-guess-the-number.md §12
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
