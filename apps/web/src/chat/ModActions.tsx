/**
 * @file   apps/web/src/chat/ModActions.tsx
 * @module web/chat
 * @brief  The actions on one chat message: Report for everyone who writes, and for moderators
 *         delete, mute 5 min / 1 h / 24 h and ban.
 *
 * Responsibility: "Report" opens a reason field and sends POST /chat/messages/:id/report;
 *                 "Moderate" (only with chat.moderate) offers the actions; each asks a
 *                 confirm sentence ("Mute Walter in the whole chat for 1 h?"), a mute or ban
 *                 also its reason, and then calls the moderation routes (Bingo 05 §3). A mute
 *                 or ban covers the whole chat (`global`). The outcome is said in a line.
 * Depends on:     react, @smg/contracts (ChatMessageView), ../shell/http, ./chatText
 * Used by:        ./ChatRoom
 * Spec:           Bingo 06 §7, Bingo 03 §12, Bingo 05 §2.5, §3
 */
import type { ChatMessageView } from '@smg/contracts';
import { useState, type ReactElement, type SyntheticEvent } from 'react';

import { api, ApiError } from '../shell/http.js';
import { chatCodeText, confirmText, MUTES, type ModAction } from './chatText.js';

type Step = 'closed' | 'report' | 'menu' | ModAction;

async function run(message: ChatMessageView, step: Step, reason: string): Promise<string> {
  const author = message.author ?? '';
  if (step === 'report') {
    await api(`/chat/messages/${message.id}/report`, { method: 'POST', body: { reason } });
    return 'Reported. A moderator will look at it.';
  }
  if (typeof step === 'string') return '';
  if (step.kind === 'delete') {
    await api(`/admin/chat/messages/${message.id}/delete`, { method: 'POST', body: {} });
    return 'Message deleted.';
  }
  const minutes = step.kind === 'mute' ? step.minutes : null;
  await api('/admin/chat/sanctions', {
    method: 'POST',
    body: { displayName: author, kind: step.kind, scope: 'global', minutes, reason },
  });
  return step.kind === 'mute' ? `${author} is muted.` : `${author} is banned from the chat.`;
}

function needsReason(step: Step): boolean {
  return step === 'report' || (typeof step === 'object' && step.kind !== 'delete');
}

// The moderator's choices for one message.
function Menu(p: { readonly author: string; readonly choose: (s: Step) => void }): ReactElement {
  return (
    <span className="smg-row" role="group" aria-label={`Moderate the message by ${p.author}`}>
      <button
        type="button"
        className="chat-link"
        onClick={() => {
          p.choose({ kind: 'delete' });
        }}
      >
        Delete
      </button>
      {MUTES.map((m) => (
        <button
          key={m.minutes}
          type="button"
          className="chat-link"
          onClick={() => {
            p.choose({ kind: 'mute', minutes: m.minutes });
          }}
        >
          Mute {m.label}
        </button>
      ))}
      <button
        type="button"
        className="chat-link"
        onClick={() => {
          p.choose({ kind: 'ban' });
        }}
      >
        Ban
      </button>
      <button
        type="button"
        className="chat-link"
        onClick={() => {
          p.choose('closed');
        }}
      >
        Cancel
      </button>
    </span>
  );
}

// The confirm sentence, the reason when the action needs one, Confirm and Cancel.
function Confirm(p: {
  readonly step: ModAction | 'report';
  readonly author: string;
  readonly onConfirm: (reason: string) => void;
  readonly onCancel: () => void;
}): ReactElement {
  const [reason, setReason] = useState('');
  const asks = needsReason(p.step);
  const minReason = p.step === 'report' ? 1 : 3;
  return (
    <form
      className="chat-confirm"
      onSubmit={(e: SyntheticEvent) => {
        e.preventDefault();
        p.onConfirm(reason.trim());
      }}
    >
      <p>
        {p.step === 'report'
          ? `Report this message by ${p.author}?`
          : confirmText(p.step, p.author)}
      </p>
      {asks ? (
        <input
          className="smg-input"
          aria-label="Reason"
          placeholder="Reason"
          maxLength={p.step === 'report' ? 300 : 500}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
          }}
        />
      ) : null}
      <span className="smg-row">
        <button
          type="submit"
          className="smg-btn smg-btn--danger"
          disabled={asks && reason.trim().length < minReason}
        >
          Confirm
        </button>
        <button type="button" className="smg-btn" onClick={p.onCancel}>
          Cancel
        </button>
      </span>
    </form>
  );
}

// The closed line: Report, and Moderate for staff.
function Closed(p: {
  readonly canReport: boolean;
  readonly canModerate: boolean;
  readonly choose: (s: Step) => void;
}): ReactElement {
  return (
    <span className="smg-row">
      {p.canReport ? (
        <button
          type="button"
          className="chat-link"
          onClick={() => {
            p.choose('report');
          }}
        >
          Report
        </button>
      ) : null}
      {p.canModerate ? (
        <button
          type="button"
          className="chat-link"
          onClick={() => {
            p.choose('menu');
          }}
        >
          Moderate
        </button>
      ) : null}
    </span>
  );
}

export function LineActions(p: {
  readonly message: ChatMessageView;
  readonly canReport: boolean;
  readonly canModerate: boolean;
}): ReactElement | null {
  const [step, setStep] = useState<Step>('closed');
  const [said, setSaid] = useState<string | null>(null);
  const author = p.message.author;
  if (author === null || p.message.text === null || (!p.canReport && !p.canModerate)) return null;
  const confirm = (reason: string): void => {
    run(p.message, step, reason)
      .then((text) => {
        setSaid(text);
        setStep('closed');
      })
      .catch((error: unknown) => {
        setSaid(chatCodeText(error instanceof ApiError ? error.code : undefined));
      });
  };
  return (
    <div className="chat-actions">
      {step === 'closed' ? (
        <Closed canReport={p.canReport} canModerate={p.canModerate} choose={setStep} />
      ) : step === 'menu' ? (
        <Menu author={author} choose={setStep} />
      ) : (
        <Confirm
          step={step}
          author={author}
          onConfirm={confirm}
          onCancel={() => {
            setStep('closed');
          }}
        />
      )}
      {said === null ? null : (
        <p role="status" className="smg-muted">
          {said}
        </p>
      )}
    </div>
  );
}
