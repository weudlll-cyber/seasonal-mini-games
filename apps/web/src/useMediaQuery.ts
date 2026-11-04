/**
 * @file   apps/web/src/useMediaQuery.ts
 * @module web
 * @brief  React hook: does a media query match, followed as it changes?
 *
 * Responsibility: read a media query once and follow its `change` events; without matchMedia
 *                 (a non-browser environment such as jsdom) the query counts as not matching.
 *                 The round view's layout is ./round/useRoundView.
 * Depends on:     react
 * Used by:        ./useReducedMotion
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
