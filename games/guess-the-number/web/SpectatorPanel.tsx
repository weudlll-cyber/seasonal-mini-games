/**
 * @file   games/guess-the-number/web/SpectatorPanel.tsx
 * @module games/guess-the-number/web
 * @brief  What a spectator sees of the game in the main area: the round's range and the hint.
 *
 * Responsibility: the range block (or "Any whole number" while it is hidden) and the shared
 *                 hint in shared mode, highlighted as on the player panel (O35), and in a Leaf
 *                 Fall round the Fallen numbers panel (./FallenNumbers, T115); the guesses
 *                 are rows of the round's one list, drawn by the platform from this view at
 *                 the round's visibility (02 §6.2, §11; O20).
 *                 Nothing about a secret, and nothing narrowed from the answers (O17).
 * Depends on:     react, @smg/game-sdk (props), @smg-game/guess-the-number (types),
 *                 ./FallenNumbers, ./RangeBar,
 *                 ./text (hint)
 * Used by:        ./index
 * Spec:           docs/spec/02-game-guess-the-number.md §6.2, §11
 */
import type { SpectatorView } from '@smg-game/guess-the-number';
import type { SpectatorPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { FallenNumbers, leafFallOn } from './FallenNumbers.js';
import { RangeBar } from './RangeBar.js';
import { freeHint } from './text.js';

export function SpectatorPanel(props: SpectatorPanelProps): ReactElement {
  const v = props.view as SpectatorView;
  return (
    <div className="gtn-spectator" data-testid="gtn-spectator">
      <RangeBar range={v.range} />
      {v.hint === null ? null : (
        <p className="gtn-hint" data-testid="hint">
          {freeHint(v.hint)}
        </p>
      )}
      {leafFallOn(props) ? <FallenNumbers removed={v.removed} /> : null}
    </div>
  );
}
