/**
 * @file   apps/web/src/useMediaQuery.ts
 * @module web
 * @brief  React hooks: does a media query match, followed as it changes; is the screen narrow?
 *
 * Responsibility: read a media query once and follow its `change` events; without matchMedia
 *                 (a non-browser environment such as jsdom) the query counts as not matching.
 *                 `useNarrow` is the round view's phone layout, the same 899 px break as the
 *                 stylesheets (../round/round.css), for parts that render differently there
 *                 rather than only look different (the guess list's latest rows, O46).
 * Depends on:     react
 * Used by:        ./useReducedMotion, ./round/RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §12; Bingo 01 §13
 */
import { useEffect, useState } from 'react';

const matches = (query: string): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(query).matches;

export function useMediaQuery(query: string): boolean {
  const [on, setOn] = useState(() => matches(query));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(query);
    const onChange = (): void => {
      setOn(media.matches);
    };
    // The query may have changed between the first render and this effect.
    onChange();
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, [query]);
  return on;
}

export const NARROW = '(max-width: 899px)';

export const useNarrow = (): boolean => useMediaQuery(NARROW);
