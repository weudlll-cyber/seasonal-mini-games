/**
 * @file   apps/web/src/round/useFit.ts
 * @module web/round
 * @brief  Fitting to the screen (O111): a screen's scale, and how many of a box's items fit.
 *
 * Responsibility: `useScreenFit`: the one platform mechanism by which a game screen fits the
 *                 space it has is the kit's `useFitScale('mini-games', …)` (its fixed parts
 *                 marked `data-sk-fit-fixed`; the scale `--fit` and `data-sk-fit-scale` on
 *                 the root, never below 0.6; each size with its floor, `--sk-floor-*` of the
 *                 kit's fit.css under `data-sk-game="mini-games"`: 13 px text, 24 px display
 *                 values, 22 px rows, 40 px touch targets on a phone). The kit fits again when
 *                 the box or the visual viewport changes size, not when web fonts finish
 *                 loading (the type swaps in after the first paint and can wrap a line anew,
 *                 T404); until a kit release does, the game fits again then by counting the
 *                 font loads into the signature (owner decision O144). `useFit`: a box of a
 *                 fixed height that never scrolls and never cuts an item shows the items
 *                 (`[data-fit]`) that fit whole and "+N more" for the rest (the Others panel
 *                 and line, O110).
 * Depends on:     react, @seasonal/kit/react (useFitScale)
 * Used by:        ./ResultScreen (useScreenFit); ./RoundIntro (useFontLoads, for the kit's
 *                 StartCard); ./OthersLine, ./RoundSide (useFit)
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02-game-guess-the-number.md §12
 */
import { useFitScale } from '@seasonal/kit/react';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

// How many times web fonts have finished loading while the screen is shown (O144, T404).
export function useFontLoads(): number {
  const [loads, setLoads] = useState(0);
  useEffect(() => {
    const fonts = 'fonts' in document ? document.fonts : null;
    const loaded = (): void => {
      setLoads((n) => n + 1);
    };
    fonts?.addEventListener('loadingdone', loaded);
    return () => {
      fonts?.removeEventListener('loadingdone', loaded);
    };
  }, []);
  return loads;
}

// The screen's scale (`--fit` on the element the returned ref is put on), fitted to its box
// by the kit, and again after a font load. `self`: the screen fills a height of its own (a
// grid sharing it out), so its own box is the one its fixed parts must fit.
export function useScreenFit<T extends HTMLElement>(
  signature: string,
  self = false,
): RefObject<T | null> {
  const loads = useFontLoads();
  return useFitScale<T>('mini-games', `${signature}|${String(loads)}`, self);
}

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
