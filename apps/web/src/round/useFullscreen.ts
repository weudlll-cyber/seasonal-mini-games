/**
 * @file   apps/web/src/round/useFullscreen.ts
 * @module web/round
 * @brief  React hook: the round view in full screen, only on the viewer's request (O46).
 *
 * Responsibility: whether the browser offers the Fullscreen API on an element here (not where
 *                 it lacks it, e.g. Safari on an iPhone, and never inside a host page's frame,
 *                 the embedded mode, 07 §1), whether the round view is in full screen now
 *                 (following `fullscreenchange`, so leaving with the browser's own controls or
 *                 Escape updates the toggle), and a toggle that requests or leaves it. Nothing
 *                 enters full screen by itself.
 * Depends on:     react
 * Used by:        ./FocusShell
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/07-integration.md §1
 */
import { useEffect, useState, type RefObject } from 'react';

export interface Fullscreen {
  readonly supported: boolean;
  readonly on: boolean;
  readonly toggle: () => void;
}

function supportedHere(): boolean {
  // In a host page's frame the embed keeps its own rules: no full screen there.
  if (window.self !== window.top) return false;
  // Older engines leave `fullscreenEnabled` out entirely: that is no support either.
  return (
    'fullscreenEnabled' in document &&
    document.fullscreenEnabled &&
    typeof document.documentElement.requestFullscreen === 'function'
  );
}

export function useFullscreen(target: RefObject<HTMLElement | null>): Fullscreen {
  const [supported] = useState(supportedHere);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!supported) return undefined;
    const follow = (): void => {
      setOn(target.current !== null && document.fullscreenElement === target.current);
    };
    document.addEventListener('fullscreenchange', follow);
    return () => {
      document.removeEventListener('fullscreenchange', follow);
    };
  }, [supported, target]);
  const toggle = (): void => {
    // A refusal (no user gesture, a policy) leaves the view as it was.
    if (!document.fullscreenElement)
      void target.current?.requestFullscreen().catch(() => undefined);
    else void document.exitFullscreen().catch(() => undefined);
  };
  return { supported, on, toggle };
}
