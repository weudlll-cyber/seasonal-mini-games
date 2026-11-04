/**
 * @file   games/safecracker/web/Board.tsx
 * @module games/safecracker/web
 * @brief  The code block of the player and spectator panel: line, digit strip and hint; the line.
 *
 * Responsibility: "4-digit code, digits 0–9" in large type; the digit strip, one chip per digit
 *                 in use, a fallen digit struck through and crossed, labelled "7,
 *                 fallen" (the strip is the Leaf Fall panel, 02b §10); Spring Herald's hint as
 *                 a highlighted line for the whole round (O35). The player panel shows the
 *                 viewer's hint (shared or own); the spectator panel only a shared one (02b §9).
 *                 The platform draws the round's list of guesses beside it (O20). The phone's
 *                 info line is the compact strip with the hint (`InfoLine`, T141).
 * Depends on:     react, @smg/game-sdk (props), @smg-game/safecracker (types), ./text
 * Used by:        ./index
 * Spec:           docs/spec/02b-game-safecracker.md §7.1, §7.3, §9, §10
 */
import type { Hint, SpectatorView } from '@smg-game/safecracker';
import type { PlayerPanelProps, SpectatorPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { codeLine, freeHint, shortHint } from './text.js';

interface BoardProps {
  readonly length: number;
  readonly digits: number;
  readonly fallen: readonly number[];
  readonly hint: Hint | null;
}

// One chip per digit in use, a fallen one struck and crossed; `compact` for the phone's line.
function DigitStrip(p: {
  readonly digits: number;
  readonly fallen: readonly number[];
  readonly compact?: boolean;
}): ReactElement {
  return (
    <ul
      className="sc-strip"
      data-compact={p.compact === true}
      aria-label="Digits in use"
      data-testid="digit-strip"
    >
      {Array.from({ length: p.digits }, (_, d) => {
        const gone = p.fallen.includes(d);
        return (
          <li
            key={d}
            className="sc-chip"
            data-fallen={gone}
            aria-label={gone ? `${String(d)}, fallen` : String(d)}
          >
            {d}
            {gone ? (
              // A cross from corner to corner over the greyed digit (T153): no small badge
              // that a phone's chip turns into a "±".
              <svg className="sc-cross" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
                <path d="M1 1 9 9M9 1 1 9" />
              </svg>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function Board({ length, digits, fallen, hint }: BoardProps): ReactElement {
  return (
    <section className="sc-board" aria-label="The code" data-testid="sc-board">
      <p className="sc-line" data-testid="code-line">
        {codeLine(length, digits)}
      </p>
      <DigitStrip digits={digits} fallen={fallen} />
      {/* The answers' words, once (T143). */}
      <p className="sc-legend" data-testid="sc-legend">
        <strong>right</strong> = right digit, right place · <strong>wrong place</strong> = right
        digit in the wrong place
      </p>
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

// The phone's info line (T141): the compact digit strip, then the hint where there is one.
export function InfoLine(props: SpectatorPanelProps): ReactElement {
  const v = props.view as SpectatorView;
  return (
    <span className="sc-line" data-testid="sc-line">
      <DigitStrip digits={v.digits} fallen={v.fallen} compact />
      {v.hint === null ? null : <span className="sc-line-hint">{shortHint(v.hint)}</span>}
    </span>
  );
}
