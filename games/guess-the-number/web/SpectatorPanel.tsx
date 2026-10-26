/**
 * @file   games/guess-the-number/web/SpectatorPanel.tsx
 * @module games/guess-the-number/web
 * @brief  What a spectator sees of the game: the round's range, the shared band and the guesses.
 *
 * Responsibility: the range bar with the shared band under `full` visibility, the shared hint
 *                 in shared mode, and per player the number of guesses, plus the numbers
 *                 (`numbers`) or the numbers with their answers (`full`), exactly as far as
 *                 the server's view goes (02 §6.2, §11). Nothing about a secret.
 * Depends on:     react, @smg/game-sdk (props), ./RangeBar, ./text
 * Used by:        ./index
 * Spec:           docs/spec/02-game-guess-the-number.md §6.2, §11
 */
import type { SpectatorPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { RangeBar } from './RangeBar.js';
import { hintText, type HintView } from './text.js';

interface Range {
  readonly low: number;
  readonly high: number;
}

interface SpectatorView {
  readonly range: Range;
  readonly removed: readonly number[];
  readonly sharedBand: Range | null;
  readonly hint: HintView | null;
  readonly players: readonly {
    readonly playerId: string;
    readonly guesses: number;
    readonly values: readonly number[] | null;
    readonly answers: readonly { readonly value: number; readonly feedback: string }[] | null;
  }[];
}

export function SpectatorPanel({ view, names }: SpectatorPanelProps): ReactElement {
  const v = view as SpectatorView;
  return (
    <div className="gtn-spectator" data-testid="gtn-spectator">
      {v.hint === null ? null : (
        <p className="gtn-hint smg-panel smg-panel--inset">
          <strong>Spring Herald:</strong> {hintText(v.hint)}
        </p>
      )}
      <RangeBar range={v.range} band={v.sharedBand} removed={v.removed} label="The round's range" />
      <ul className="gtn-players" aria-label="Guesses so far">
        {v.players.map((p) => (
          <li key={p.playerId}>
            <strong>{names[p.playerId] ?? p.playerId}</strong>: {p.guesses}{' '}
            {p.guesses === 1 ? 'guess' : 'guesses'}
            {p.answers !== null && p.answers.length > 0
              ? ` — ${p.answers.map((a) => `${String(a.value)} ${a.feedback}`).join(', ')}`
              : p.values !== null && p.values.length > 0
                ? ` — ${p.values.join(', ')}`
                : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
