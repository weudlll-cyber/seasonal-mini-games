/**
 * @file   apps/web/src/round/useRowsFit.ts
 * @module web/round
 * @brief  React hook: how many rows of a table fit its box's height, never a scrollbar.
 *
 * Responsibility: for a box whose height its styles fix (overflow hidden) and which holds one
 *                 table: the number of body rows that fit under the header, measured from the
 *                 box's height and one row's, again whenever the box's size changes; on a
 *                 phone (../round/useRoundView's rule) a fixed four, the top three and the
 *                 viewer (T358); where nothing is laid out (tests) six. @smg/ui `useFit` counts
 *                 the items that show whole, but it needs the items as the box's children,
 *                 which a table's rows are not.
 * Depends on:     react, ./useRoundView (viewOf)
 * Used by:        ./RoundStandings
 * Spec:           docs/spec/02e-game-mind-games.md §9
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { viewOf } from './useRoundView.js';

const PHONE_ROWS = 4;
const UNMEASURED = 6;

// The rows that fit now.
function rowsIn(box: HTMLElement): number {
  if (viewOf(window.innerWidth, window.innerHeight) === 'phone') return PHONE_ROWS;
  const row = box.querySelector('tbody tr')?.getBoundingClientRect().height ?? 0;
  const head = box.querySelector('thead')?.getBoundingClientRect().height ?? 0;
  if (box.clientHeight === 0 || row === 0) return UNMEASURED;
  // At least one row: the viewer's own.
  return Math.max(1, Math.floor((box.clientHeight - head + 1) / row));
}

// `shown`: whether the box is on the page now (the standings may arrive after the result).
export function useRowsFit<T extends HTMLElement>(
  shown: boolean,
): {
  readonly ref: RefObject<T | null>;
  readonly rows: number;
} {
  const ref = useRef<T>(null);
  const [rows, setRows] = useState(UNMEASURED);
  useLayoutEffect(() => {
    const box = ref.current;
    if (box === null) return undefined;
    const measure = (): void => {
      setRows(rowsIn(box));
    };
    measure();
    // Browsers only; a test's DOM has no layout to follow.
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    watch?.observe(box);
    window.addEventListener('resize', measure);
    return () => {
      watch?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [shown]);
  return { ref, rows };
}
