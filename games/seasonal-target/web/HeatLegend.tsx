/**
 * @file   games/seasonal-target/web/HeatLegend.tsx
 * @module games/seasonal-target/web
 * @brief  The grid's small legend: "Cold", the five colour steps, "Hot".
 *
 * Responsibility: the scale a guessed tile's fill is read on (O45), the same swatches as the
 *                 tiles (./tiles.css), the words written out so colour is never alone; every
 *                 answer is also in words on its tile's label and in the guess list.
 * Depends on:     react
 * Used by:        ./TargetInput, ./SpectatorPanel, ./ResultPanel
 * Spec:           docs/spec/02d-game-seasonal-target.md §6
 */
import type { ReactElement } from 'react';

const STEPS = [1, 2, 3, 4, 5] as const;

export function HeatLegend(): ReactElement {
  return (
    <p className="st-heat" data-testid="heat-legend">
      <span>Cold</span>
      {STEPS.map((s) => (
        <span key={s} className="st-swatch" data-step={s} aria-hidden="true" />
      ))}
      <span>Hot</span>
    </p>
  );
}
