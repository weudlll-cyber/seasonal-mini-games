/**
 * @file   games/mind-games/web/MindInput.tsx
 * @module games/mind-games/web
 * @brief  A player's stage: the phase strip, the choice buttons and Hide my switches.
 *
 * Responsibility: drawn into the round's stage (the board layout, O51): the phase strip with
 *                 the round's timing, the choice row and, in a `perPlayer` round only, the box
 *                 "Hide my switches" (02e §6.3, §11). A click sends the choice at once with the
 *                 box as it stands (02e §5.1, no separate Send); the viewer's own choice comes back
 *                 live in their own view. The buttons are off where the page already knows the
 *                 answer (02e §5.2): after the play's end (the platform's `canAct`), and after the
 *                 join time for a player not yet in the round, who reads why. The box is the
 *                 player's match value: it starts from their prefs (else their last choice in
 *                 this round) and is saved there, so it holds for the rest of the match
 *                 (./useSavedPrefs). A pre-pick the round refused is told to its player alone:
 *                 "Your pre-pick All was not offered in round 3." (02e §7), from the server's
 *                 `prefs.refused` as it arrives, or from the player's own pre-pick and the
 *                 round's rules after a reconnect. A refusal is said under the row in the game's
 *                 words (02e §5.2); the server decides every case.
 * Depends on:     react, react-dom (portal), @smg/game-sdk (panel props),
 *                 @smg-game/mind-games (views, names), ./ChoiceButtons, ./PhaseStrip, ./phases,
 *                 ./text, ./useSavedPrefs
 * Used by:        ./index
 * Spec:           docs/spec/02e-game-mind-games.md §5, §6.3, §7, §11
 */
import { CHOICE_NAMES, type Choice, type PlayerView } from '@smg-game/mind-games';
import type { OwnMatchPart, PlayerPanelProps } from '@smg/game-sdk';
import { useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { ChoiceButtons } from './ChoiceButtons.js';
import { PhaseStrip } from './PhaseStrip.js';
import { sinceOpening } from './phases.js';
import { mindText } from './text.js';
import { useSavedPrefs, type Prefs } from './useSavedPrefs.js';

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

// The player's notice of a pre-pick this round refused, or null (02e §7).
function prePickNotice(own: OwnMatchPart | undefined, view: PlayerView): string | null {
  if (own === undefined || view.own.choice !== null) return null;
  const pick = (own.prefs as Prefs | null)?.picks[String(own.roundIndex)];
  const offered = pick !== 'all' || view.rules.allOption;
  if (pick === undefined || (offered && own.refusedPrePick === null)) return null;
  const round = String(own.roundIndex);
  if (!offered || own.refusedPrePick === 'CHOICE_UNAVAILABLE') {
    return `Your pre-pick ${CHOICE_NAMES[pick]} was not offered in round ${round}.`;
  }
  const why = mindText.code(own.refusedPrePick ?? '') ?? 'refused';
  return `Your pre-pick for round ${round} was not taken: ${why}`;
}

const NO_SAVE = () => Promise.resolve({ ok: true });

// The box: the player's prefs keep it for the match; without prefs, their last choice's.
function useHide(p: MindInputProps, view: PlayerView) {
  const saved = useSavedPrefs(p.own?.prefs ?? null, p.own?.save ?? NO_SAVE);
  const [local, setLocal] = useState(view.own.hide);
  const hide = p.own === undefined ? local : (saved.draft.hide ?? view.own.hide);
  const set = (next: boolean): void => {
    if (p.own === undefined) setLocal(next);
    else saved.change({ ...saved.draft, hide: next });
  };
  return { hide, set };
}

export function MindInput(p: MindInputProps): ReactElement {
  const view = p.view as PlayerView;
  const { hide, set } = useHide(p, view);
  const [message, setMessage] = useState<string | null>(null);
  // After the join time a player not yet in the round can no longer enter (02e §5.2 check 4).
  const shut =
    p.timing !== undefined &&
    view.own.choice === null &&
    sinceOpening(p.timing) >= p.timing.plan.entryEndMs;
  const choose = (choice: Choice): void => {
    void p.act({ value: { choice, hide } }).then((reply) => {
      setMessage(reply.ok ? null : (mindText.code(reply.code ?? '') ?? null));
    });
  };
  const notice = prePickNotice(p.own, view) ?? (shut ? mindText.code('JOIN_CLOSED') : null);
  const said = message ?? notice;
  const stage = (
    <div className="mg-stage" data-testid="mind-stage">
      <PhaseStrip view={view} timing={p.timing} />
      <ChoiceButtons
        view={view}
        own={view.own.choice}
        choose={choose}
        canAct={p.canAct && !shut}
        names={p.names}
      />
      {view.rules.switchVisibility === 'perPlayer' ? <HideBox hide={hide} set={set} /> : null}
    </div>
  );
  return (
    <div className="mg-input">
      {p.stage == null ? stage : createPortal(stage, p.stage)}
      {said === null ? null : (
        <p role="status" className="mg-refusal">
          {said}
        </p>
      )}
    </div>
  );
}
