/**
 * @file   games/seasonal-target/web/HeatLegend.tsx
 * @module games/seasonal-target/web
 * @brief  The grid's small legend: "Cold", the colour steps of the round's mode, "Hot".
 *
 * Responsibility: the scale a guessed tile's fill is read on (O45), the same swatches as the
 *                 tiles (./heat.css): five steps in `distance` and `direction` mode, seven in
 *                 `closeness` mode, one a tier (T151); the words written out so colour is
 *                 never alone; every answer is also in words on its tile's label and in the
 *                 guess list.
 * Depends on:     react, @smg-game/seasonal-target (types)
 * Used by:        ./TargetInput, ./SpectatorPanel, ./ResultPanel
 * Spec:           docs/spec/02d-game-seasonal-target.md §6
 */
import type { PlayerView } from '@smg-game/seasonal-target';
import type { ReactElement } from 'react';

const STEPS = ['1', '2', '3', '4', '5'] as const;
const CLOSE_STEPS = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7'] as const;

export function HeatLegend({ mode }: { readonly mode: PlayerView['feedbackMode'] }): ReactElement {
  const steps = mode === 'closeness' ? CLOSE_STEPS : STEPS;
  return (
    <p className="st-heat" data-testid="heat-legend">
      <span>Cold</span>
      {steps.map((s) => (
        <span key={s} className="st-swatch" data-step={s} aria-hidden="true" />
      ))}
      <span>Hot</span>
    </p>
  );
}
