/**
 * @file   games/mind-games/web/MindInput.tsx
 * @module games/mind-games/web
 * @brief  A player's stage: the phase strip, the choice buttons and Hide my switches.
 *
 * Responsibility: drawn into the round's stage (the board layout, O51): the phase strip, the
 *                 choice row and, in a `perPlayer` round only, the box "Hide my
 *                 switches" (02e §6.3, §11). A click sends the choice at once with the box as
 *                 it stands (02e §5.1, no separate Send); the viewer's own choice and box come
 *                 back live in their own view. A refusal is said under the row in the game's
 *                 words (02e §5.2); the server decides every case. The box starts as the
 *                 player's last choice left it.
 * Depends on:     react, react-dom (portal), @smg/game-sdk (panel props),
 *                 @smg-game/mind-games (views), ./ChoiceButtons, ./PhaseStrip, ./text
 * Used by:        ./index
 * Spec:           docs/spec/02e-game-mind-games.md §5, §6.3, §11
 */
import type { Choice, PlayerView } from '@smg-game/mind-games';
import type { PlayerPanelProps } from '@smg/game-sdk';
import { useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { ChoiceButtons } from './ChoiceButtons.js';
import { PhaseStrip } from './PhaseStrip.js';
import { mindText } from './text.js';

export type MindInputProps = PlayerPanelProps & {
  readonly ring?: ReactNode;
  readonly stage?: HTMLElement | null;
};

export const HIDE_TIP = 'While this is ticked, your switches show only in the counts.';

function HideBox(p: { readonly hide: boolean; readonly set: (hide: boolean) => void }) {
  return (
    <label className="mg-hide" title={HIDE_TIP}>
      <input
        type="checkbox"
        checked={p.hide}
        onChange={(e) => {
          p.set(e.target.checked);
        }}
      />{' '}
      Hide my switches
    </label>
  );
}

export function MindInput(p: MindInputProps): ReactElement {
  const view = p.view as PlayerView;
  const [hide, setHide] = useState(view.own.hide);
  const [message, setMessage] = useState<string | null>(null);
  const choose = (choice: Choice): void => {
    void p.act({ value: { choice, hide } }).then((reply) => {
      setMessage(reply.ok ? null : (mindText.code(reply.code ?? '') ?? null));
    });
  };
  const stage = (
    <div className="mg-stage" data-testid="mind-stage">
      <PhaseStrip view={view} />
      <ChoiceButtons view={view} own={view.own.choice} choose={choose} canAct={p.canAct} />
      {view.rules.switchVisibility === 'perPlayer' ? <HideBox hide={hide} set={setHide} /> : null}
    </div>
  );
  return (
    <div className="mg-input">
      {p.stage == null ? stage : createPortal(stage, p.stage)}
      {message === null ? null : (
        <p role="status" className="mg-refusal">
          {message}
        </p>
      )}
    </div>
  );
}
