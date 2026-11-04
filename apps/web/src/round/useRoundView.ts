/**
 * @file   apps/web/src/round/useRoundView.ts
 * @module web/round
 * @brief  React hook: which of the two round layouts the viewport gets, desktop or phone.
 *
 * Responsibility: the one choice of layout for every game (T141): a landscape viewport at
 *                 least 900 px wide is the desktop (bar, stage, info column), anything narrower
 *                 or in portrait the phone (bar, info line, stage, action dock); followed as
 *                 the window is resized or turned. The round view sets it on its container
 *                 (`data-view`, ./round.css), so styles and parts that render differently (the
 *                 info column, the phone's comment toggle) agree.
 * Depends on:     react
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §12
 */
import { useEffect, useState } from 'react';

export type RoundView = 'desktop' | 'phone';

// The desktop needs both the width and a landscape viewport.
export const viewOf = (width: number, height: number): RoundView =>
  width >= 900 && width >= height ? 'desktop' : 'phone';

const current = (): RoundView => viewOf(window.innerWidth, window.innerHeight);

export function useRoundView(): RoundView {
  const [view, setView] = useState(current);
  useEffect(() => {
    const onResize = (): void => {
      setView(current());
    };
    // The size may have changed between the first render and this effect.
    onResize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return view;
}
