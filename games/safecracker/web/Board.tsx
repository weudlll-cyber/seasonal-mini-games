/**
 * @file   games/safecracker/web/Board.tsx
 * @module games/safecracker/web
 * @brief  The code block of the player and spectator main area: line, digit strip and hint.
 *
 * Responsibility: "4-digit code, digits 0–9" in large type; the digit strip, one chip per digit
 *                 in use, a fallen digit struck through and crossed, labelled "7,
 *                 fallen" (the strip is the Leaf Fall panel, 02b §10); Spring Herald's hint as
 *                 a highlighted line for the whole round (O35). The player panel shows the
 *                 viewer's hint (shared or own); the spectator panel only a shared one (02b §9).
 *                 The platform draws the round's one list of guesses and events beneath (O20).
 * Depends on:     react, @smg/game-sdk (props), @smg-game/safecracker (types), ./text
 * Used by:        ./index
 * Spec:           docs/spec/02b-game-safecracker.md §7.1, §7.3, §9, §10
 */
import type { Hint, SpectatorView } from '@smg-game/safecracker';
import type { PlayerPanelProps, SpectatorPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { codeLine, freeHint } from './text.js';

interface BoardProps {
  readonly length: number;
  readonly digits: number;
  readonly fallen: readonly number[];
  readonly hint: Hint | null;
}

export function Board({ length, digits, fallen, hint }: BoardProps): ReactElement {
  return (
    <section className="sc-board" aria-label="The code" data-testid="sc-board">
      <p className="sc-line" data-testid="code-line">
        {codeLine(length, digits)}
      </p>
      <ul className="sc-strip" aria-label="Digits in use" data-testid="digit-strip">
        {Array.from({ length: digits }, (_, d) => {
          const gone = fallen.includes(d);
          return (
            <li
              key={d}
              className="sc-chip"
              data-fallen={gone}
              aria-label={gone ? `${String(d)}, fallen` : String(d)}
            >
              {d}
              {gone ? (
                <span className="sc-cross" aria-hidden="true">
                  ✕
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {hint === null ? null : (
        <p className="sc-hint" data-testid="hint">
          {freeHint(hint)}
        </p>
      )}
    </section>
  );
}

// Both views carry the board's parts; a player's hint is their own in individual mode.
export function PlayerPanel(props: PlayerPanelProps): ReactElement {
  return <Board {...(props.view as SpectatorView)} />;
}

export function SpectatorPanel(props: SpectatorPanelProps): ReactElement {
  return <Board {...(props.view as SpectatorView)} />;
}
