/**
 * @file   apps/web/src/round/CooldownRing.tsx
 * @module web/round
 * @brief  The cooldown ring: the seconds a player still waits, as a closing circle.
 *
 * Responsibility: from the cooldown's end time the server sent (corrected by the clock
 *                 offset) and the cooldown in force, draw the ring and the seconds left, or
 *                 once ready a check mark sized to the ring, named "Ready" (02 §7, T150).
 *                 Only a display: the server enforces the cooldown.
 *                 Without motion when the player asks for reduced motion.
 * Depends on:     react, ./cooldownRing.css
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §7, §12
 */
import type { ReactElement } from 'react';

import './cooldownRing.css';

interface CooldownRingProps {
  readonly endsAt: number;
  readonly cooldownMs: number;
  readonly now: number;
}

const R = 26;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function CooldownRing({ endsAt, cooldownMs, now }: CooldownRingProps): ReactElement {
  const leftMs = Math.max(0, endsAt - now);
  const ready = leftMs === 0;
  const share = ready ? 0 : Math.min(1, leftMs / Math.max(1, cooldownMs));
  const label = `${String(Math.ceil(leftMs / 1_000))} s`;
  return (
    <div
      className="round-ring"
      role="timer"
      aria-label={ready ? 'Ready' : `Cooldown, ${label} left`}
      data-ready={ready}
      data-testid="cooldown"
      // The cooldown in force (Heatwave lowers it), for the tests: the bar no longer shows it.
      data-cooldown-ms={cooldownMs}
    >
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        <circle cx="32" cy="32" r={R} className="round-ring-track" />
        <circle
          cx="32"
          cy="32"
          r={R}
          className="round-ring-left"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - share)}
        />
      </svg>
      {ready ? (
        // The word "Ready" did not fit the ring (night-7 review): a check mark in its middle.
        <svg className="round-ring-check" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M20 33 l8 8 l16 -18" />
        </svg>
      ) : (
        <span className="round-ring-label">{label}</span>
      )}
    </div>
  );
}
