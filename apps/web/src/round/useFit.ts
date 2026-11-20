/**
 * @file   apps/web/src/round/useFit.ts
 * @module web/round
 * @brief  Fitting to the screen (O111): a screen's scale, and how many of a box's items fit.
 *
 * Responsibility: the one platform mechanism by which a game screen fits the space it has.
 *                 `useFitScale`: a screen (its root) names its fixed parts (`[data-fit-fixed]`,
 *                 else all its children); the space they have is the nearest box that clips or
 *                 scrolls (the root itself, or the screen's named scroll area). The scale is the
 *                 largest value ≤ 1 at which the fixed parts fit that box, never below
 *                 `FIT_FLOOR`; it is set on the root as the CSS custom property `--fit`, which the
 *                 screen's type, row heights, paddings and gaps multiply, each size with its own
 *                 readable floor in the CSS (13 px text, 24 px display values, 22 px rows, 40 px
 *                 touch targets on a phone), and as `data-fit-scale` for tests. Where there is
 *                 room the scale is 1 and the screen looks as without it. It is measured anew
 *                 only when the box's size changes (resize, rotation, the on-screen keyboard
 *                 changing the visual viewport) or the screen's content does (`signature`), each
 *                 time from 1 in at most a few passes inside one task (the first before the
 *                 first paint, a resize's in its next frame): no loop, no React state, no
 *                 visible jump after the first paint. `useFit`: a box of a fixed height that
 *                 never scrolls and never cuts an item shows the items (`[data-fit]`) that fit
 *                 whole and "+N more" for the rest (the Others panel and line, O110).
 * Depends on:     react
 * Used by:        ./RoundIntro, ./ResultScreen (useFitScale); ./OthersLine, ./RoundSide (useFit)
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02-game-guess-the-number.md §12
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

// Below this scale nothing shrinks further: the screen's scroll area takes the rest.
export const FIT_FLOOR = 0.6;

// The passes of one fitting: each measures at the scale of the last one.
const PASSES = 5;

// The next scale from one measurement: the fixed parts took `used` pixels of `room` at the
// scale `current`; they shrink about in proportion, so the largest scale ≤ 1 that fits, a
// little under it to stay inside (never below the floor). Already fitting: `current` stays.
export function nextScale(current: number, used: number, room: number, floor = FIT_FLOOR) {
  if (used <= room + 0.5 || used <= 0 || room <= 0) return current;
  const next = Math.min(1, (current * room) / used) - 0.005;
  return Math.max(floor, Math.round(next * 1000) / 1000);
}

// The box the screen's fixed parts must fit: the root itself when it clips or scrolls, else
// the nearest such ancestor (the result's scroll area, the phone's content).
function boxOf(root: HTMLElement): HTMLElement {
  for (let e: HTMLElement | null = root; e !== null; e = e.parentElement) {
    const s = getComputedStyle(e);
    if (s.overflowY !== 'visible' && s.overflowY !== '') return e;
  }
  return document.documentElement;
}

// How far the fixed parts reach in the box's content, from its top edge, and its room.
function measure(root: HTMLElement, box: HTMLElement) {
  const marked = root.querySelectorAll<HTMLElement>('[data-fit-fixed]');
  const parts = marked.length > 0 ? [...marked] : [...root.children];
  const b = box.getBoundingClientRect();
  const top = b.top + box.clientTop - box.scrollTop;
  let low = top;
  let high = top;
  for (const part of parts) {
    const r = part.getBoundingClientRect();
    low = Math.min(low, r.top);
    high = Math.max(high, r.bottom);
  }
  const pad = parseFloat(getComputedStyle(box).paddingBottom) || 0;
  return { used: high - low + pad, room: box.clientHeight };
}

// One fitting: from 1, a few passes down to the scale at which the fixed parts fit.
export function settle(root: HTMLElement, box: HTMLElement = boxOf(root)): number {
  let scale = 1;
  root.style.setProperty('--fit', '1');
  for (let pass = 0; pass < PASSES; pass += 1) {
    const { used, room } = measure(root, box);
    const next = nextScale(scale, used, room);
    if (next >= scale) break;
    scale = next;
    root.style.setProperty('--fit', String(scale));
  }
  root.dataset['fitScale'] = String(scale);
  return scale;
}

// The screen's scale (`--fit` on the element the returned ref is put on), fitted to its box.
export function useFitScale<T extends HTMLElement>(signature: string): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (root === null) return undefined;
    const box = boxOf(root);
    settle(root, box);
    // A new size of the box, or of the visual viewport (a phone's keyboard), fits again;
    // the scale's own change of the root's height is not watched, so nothing loops.
    // Fitting again in the next frame, never inside the observer's own delivery, so no other
    // observer of the page is notified in a loop.
    let size = `${String(box.clientWidth)}x${String(box.clientHeight)}`;
    let frame = 0;
    const resized = (): void => {
      const now = `${String(box.clientWidth)}x${String(box.clientHeight)}`;
      if (now === size) return;
      size = now;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        settle(root, box);
      });
    };
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resized);
    watch?.observe(box);
    window.visualViewport?.addEventListener('resize', resized);
    return () => {
      cancelAnimationFrame(frame);
      watch?.disconnect();
      window.visualViewport?.removeEventListener('resize', resized);
    };
  }, [signature]);
  return ref;
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
