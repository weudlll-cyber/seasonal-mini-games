/**
 * @file   apps/web/src/round/CooldownRing.tsx
 * @module web/round
 * @brief  The cooldown ring: the seconds a player still waits, as a closing circle.
 *
 * Responsibility: from the cooldown's end time the server sent (corrected by the clock
 *                 offset) and the cooldown in force, draw the ring and the seconds left, or
 *                 "Ready" (02 §7). Only a display: the server enforces the cooldown.
 *                 Without motion when the player asks for reduced motion.
 * Depends on:     react
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §7, §12
 */
import type { ReactElement } from 'react';

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
  const label = ready ? 'Ready' : `${String(Math.ceil(leftMs / 1_000))} s`;
  return (
    <div
      className="round-ring"
      role="timer"
      aria-label={ready ? 'Ready to guess' : `Cooldown, ${label} left`}
      data-testid="cooldown"
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
      <span className="round-ring-label">{label}</span>
    </div>
  );
}
