/**
 * @file   games/guess-the-number/web/SpectatorPanel.tsx
 * @module games/guess-the-number/web
 * @brief  What a spectator sees of the game: the round's range and the guesses so far.
 *
 * Responsibility: the range block (or "Any whole number" while it is hidden), the shared hint
 *                 in shared mode, and per player the number of guesses, plus the numbers
 *                 (`numbers`) or the numbers with their answers (`full`), exactly as far as
 *                 the server's view goes (02 §6.2, §11). Nothing about a secret, and nothing
 *                 narrowed from the answers (O17).
 * Depends on:     react, @smg/game-sdk (props), @smg-game/guess-the-number (types), ./RangeBar,
 *                 ./text
 * Used by:        ./index
 * Spec:           docs/spec/02-game-guess-the-number.md §6.2, §11
 */
import type { SpectatorView } from '@smg-game/guess-the-number';
import type { SpectatorPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { RangeBar } from './RangeBar.js';
import { ARROWS, hintText } from './text.js';

export function SpectatorPanel({ view, names }: SpectatorPanelProps): ReactElement {
  const v = view as SpectatorView;
  return (
    <div className="gtn-spectator" data-testid="gtn-spectator">
      <RangeBar range={v.range} removed={v.removed} />
      {v.hint === null ? null : (
        <p className="gtn-hint">
          <strong>Spring Herald:</strong> {hintText(v.hint)}
        </p>
      )}
      <ul className="gtn-players" aria-label="Guesses so far">
        {v.players.map((p) => (
          <li key={p.playerId}>
            <strong>{names[p.playerId] ?? p.playerId}</strong>: {p.guesses}{' '}
            {p.guesses === 1 ? 'guess' : 'guesses'}
            {p.answers !== null && p.answers.length > 0
              ? ` — ${p.answers.map((a) => `${String(a.value)} ${ARROWS[a.feedback]}`).join(', ')}`
              : p.values !== null && p.values.length > 0
                ? ` — ${p.values.join(', ')}`
                : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
