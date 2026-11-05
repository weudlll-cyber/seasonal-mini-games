/**
 * @file   apps/web/src/round/PlayerSteps.tsx
 * @module web/round
 * @brief  A website member's Discord steps beside the name: the icon, or the step's name.
 *
 * Responsibility: at most three steps (07 §7), each as its small icon (a same-origin path the
 *                 CSP's img-src 'self' covers) with the step's name as its text alternative and
 *                 title, or as the name in small text when the step has no icon. Nothing at all
 *                 without steps (a standalone install sends none).
 * Depends on:     react, @smg/contracts (PlayerStepView), ./playerName.css
 * Used by:        ./PlayerName, ./GuessLine, ../boards/PlayerBoard, ../boards/ProfilePage
 * Spec:           docs/spec/07-integration.md §7 (owner decision 66)
 */
import type { PlayerStepView } from '@smg/contracts';
import type { ReactElement } from 'react';

import './playerName.css';

export function PlayerSteps({
  steps,
}: {
  readonly steps: readonly PlayerStepView[] | undefined;
}): ReactElement | null {
  if (steps === undefined || steps.length === 0) return null;
  return (
    <span className="player-steps" data-testid="player-steps">
      {steps.map((s, i) =>
        s.icon === null ? (
          <span key={`${s.ladder}-${String(i)}`} className="player-step-name">
            {s.name}
          </span>
        ) : (
          <img
            key={`${s.ladder}-${String(i)}`}
            className="player-step-icon"
            src={s.icon}
            alt={s.name}
            title={s.name}
            width="16"
            height="16"
            loading="lazy"
          />
        ),
      )}
    </span>
  );
}
