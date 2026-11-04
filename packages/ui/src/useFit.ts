/**
 * @file   packages/ui/src/useFit.ts
 * @module ui
 * @brief  How many items of a list whose box clips it show whole.
 *
 * Responsibility: a list given a height limit by its styles (whole rows, overflow hidden)
 *                 shows its first items; `useFit` counts those whose bottom is inside the
 *                 list's box, again whenever the list's size changes, so the caller can say
 *                 "+N more" for the rest. A list without a limit, or not laid out (tests),
 *                 shows all. The list must be the offset parent of its items
 *                 (`position: relative`).
 * Depends on:     react
 * Used by:        games/guess-the-number/web/FallenNumbers
 * Spec:           docs/spec/02-game-guess-the-number.md §12 (owner decision 58)
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

// The items whose bottom lies inside the list's box; all of them while it has no height.
export function fitCount(list: HTMLElement): number {
  const items = Array.from(list.children) as HTMLElement[];
  const limit = list.clientHeight;
  if (limit === 0) return items.length;
  // One pixel of slack for rounding between rows.
  return items.filter((el) => el.offsetTop + el.offsetHeight <= limit + 1).length;
}

export function useFit<T extends HTMLElement>(
  count: number,
): { readonly ref: RefObject<T | null>; readonly fit: number } {
  const ref = useRef<T>(null);
  const [fit, setFit] = useState(count);
  useLayoutEffect(() => {
    const list = ref.current;
    if (list === null) {
      setFit(count);
      return undefined;
    }
    const measure = (): void => {
      setFit(fitCount(list));
    };
    measure();
    // Browsers only; a test's DOM has no layout to follow.
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    watch?.observe(list);
    return () => {
      watch?.disconnect();
    };
  }, [count]);
  return { ref, fit: Math.min(fit, count) };
}
