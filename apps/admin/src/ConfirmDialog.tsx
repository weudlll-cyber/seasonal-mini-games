/**
 * @file   apps/admin/src/ConfirmDialog.tsx
 * @module admin
 * @brief  The one confirm dialog of the admin app for destructive or high-impact actions.
 *
 * Responsibility: a modal dialog that states the action's effect in one sentence (Bingo 11
 *                 §1), optionally asks for a reason or a code (the confirm button stays off
 *                 until it is long enough), runs the action and closes on success, or shows
 *                 why it failed and stays open. Escape and Cancel close it without acting.
 *                 `useConfirm` gives a page one dialog it opens with the request of the moment.
 *                 Used for abort, kick, result removal, suspension, role changes, rollback,
 *                 sanctions and their lifting, security settings, and the two-factor step-up.
 * Depends on:     react, ./http (failureText), ./TextInput
 * Used by:        ./StepUp, ./live/*, ./accounts/*, ./settings/*, ./moderation/*, ./twofactor/*
 * Spec:           Bingo 11 §1; Bingo 01 §13 (forms)
 */
import { useEffect, useId, useRef, useState, type ReactElement } from 'react';

import { failureText } from './http.js';
import { TextInput } from './TextInput.js';

export interface ConfirmRequest {
  readonly title: string;
  // One sentence: what happens when the action is confirmed.
  readonly effect: string;
  readonly confirmLabel: string;
  readonly danger?: boolean;
  // A reason or code the action needs, at least `minLength` characters long.
  readonly ask?: { readonly label: string; readonly minLength: number };
  readonly action: (input: string) => Promise<unknown>;
}

interface ConfirmProps extends ConfirmRequest {
  readonly onClose: (done: boolean) => void;
}

function Buttons(b: {
  readonly p: ConfirmProps;
  readonly ready: boolean;
  readonly confirm: () => void;
}): ReactElement {
  return (
    <div className="smg-row">
      <button
        type="button"
        className="smg-btn"
        onClick={() => {
          b.p.onClose(false);
        }}
      >
        Cancel
      </button>
      <button
        type="button"
        className={`smg-btn ${b.p.danger === true ? 'smg-btn--danger' : 'smg-btn--primary'}`}
        disabled={!b.ready}
        onClick={b.confirm}
        data-testid="confirm-action"
      >
        {b.p.confirmLabel}
      </button>
    </div>
  );
}

export function ConfirmDialog(p: ConfirmProps): ReactElement {
  const [input, setInput] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Focus the first field (or the cancel button), so the keyboard starts in the dialog.
    box.current?.querySelector<HTMLElement>('input, button')?.focus();
  }, []);
  const ready = !busy && input.trim().length >= (p.ask?.minLength ?? 0);
  const confirm = (): void => {
    setBusy(true);
    p.action(input.trim())
      .then(() => {
        p.onClose(true);
      })
      .catch((error: unknown) => {
        setProblem(failureText(error, p.confirmLabel));
        setBusy(false);
      });
  };
  return (
    <div className="admin-scrim">
      <div
        ref={box}
        className="smg-panel smg-stack admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === 'Escape') p.onClose(false);
        }}
      >
        <h2 id={titleId}>{p.title}</h2>
        <p data-testid="confirm-effect">{p.effect}</p>
        {p.ask === undefined ? null : (
          <TextInput
            label={p.ask.label}
            visible
            value={input}
            onChange={setInput}
            maxLength={200}
          />
        )}
        {problem === null ? null : <p role="alert">{problem}</p>}
        <Buttons p={p} ready={ready} confirm={confirm} />
      </div>
    </div>
  );
}

// One dialog per page: `open(request)` shows it; `after` runs once an action succeeded.
export function useConfirm(after?: () => void): [ReactElement | null, (r: ConfirmRequest) => void] {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const element =
    request === null ? null : (
      <ConfirmDialog
        {...request}
        onClose={(done) => {
          setRequest(null);
          if (done) after?.();
        }}
      />
    );
  return [element, setRequest];
}
