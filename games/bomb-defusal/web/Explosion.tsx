/**
 * @file   games/bomb-defusal/web/Explosion.tsx
 * @module games/bomb-defusal/web
 * @brief  The explosion on the guesser's screen when the answer to a wrong first cut arrives.
 *
 * Responsibility: `useExplosion` watches the player's own answered sequences and turns on for
 *                 about 1 s when a new one has no right cut — when its answer arrives, so under
 *                 Frost only after the delay (02c §5.2); answers already there when the screen
 *                 opens never explode again. `Explosion` is the flash over the screen with the
 *                 icon and "Boom!": ./explosion.css flashes it at most twice a second and shakes it
 *                 (WCAG 2.3.1), and with reduced motion shows one static tinted frame. It never
 *                 blocks a tap. Others never see it (02c §5.2).
 * Depends on:     react, @smg-game/bomb-defusal (types), ./text, ./explosion.css
 * Used by:        ./WireInput
 * Spec:           docs/spec/02c-game-bomb-defusal.md §5.2
 */
import type { PlayerView } from '@smg-game/bomb-defusal';
import { useEffect, useRef, useState, type ReactElement } from 'react';

import './explosion.css';

import { BOOM_ICON } from './text.js';

const BOOM_MS = 1_000;

type Own = PlayerView['guesses'];

// The newest own sequence whose answer has arrived.
const lastAnswered = (guesses: Own): number =>
  Math.max(0, ...guesses.filter((g) => g.feedback !== null).map((g) => g.receiveSeq));

export function useExplosion(guesses: Own): boolean {
  const seen = useRef(lastAnswered(guesses));
  const [on, setOn] = useState(false);
  useEffect(() => {
    const fresh = guesses.filter((g) => g.feedback !== null && g.receiveSeq > seen.current);
    seen.current = Math.max(seen.current, lastAnswered(guesses));
    if (fresh.some((g) => g.feedback?.correct === 0)) setOn(true);
  }, [guesses]);
  useEffect(() => {
    if (!on) return undefined;
    const timer = setTimeout(() => {
      setOn(false);
    }, BOOM_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [on]);
  return on;
}

export function Explosion(): ReactElement {
  return (
    <div className="bd-boom" role="alert" data-testid="explosion">
      <span className="bd-boom-icon" aria-hidden="true">
        {BOOM_ICON}
      </span>
      <strong>Boom!</strong>
    </div>
  );
}
