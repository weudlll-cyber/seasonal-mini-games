/**
 * @file   apps/admin/src/moderation/ReportsPanel.tsx
 * @module admin/moderation
 * @brief  The report queue of the builtin chat: read, delete the message, resolve.
 *
 * Responsibility: reports by status (`GET /admin/moderation/reports?status=`), each with the
 *                 reported message, its author, the reporter and the reason; delete the
 *                 message through the confirm dialog (`POST /admin/chat/messages/:id/delete`);
 *                 resolve as actioned or dismissed with an optional note (`POST
 *                 …/reports/:id/resolve`). Sanctions are given in ./SanctionsPanel.
 * Depends on:     react, @smg/contracts (ChatReportView), ../ConfirmDialog, ../http
 * Used by:        ./ModerationPage
 * Spec:           Bingo 11 §3.5; Bingo 03 §12; Bingo 05 §3
 */
import type { ChatReportView } from '@smg/contracts';
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { useConfirm, type ConfirmRequest } from '../ConfirmDialog.js';
import { api, failureText } from '../http.js';

const STATUSES = ['open', 'actioned', 'dismissed'] as const;
type Status = (typeof STATUSES)[number];

function deleteRequest(r: ChatReportView): ConfirmRequest {
  return {
    title: 'Delete this message',
    effect: `The message of ${r.message.author ?? 'a removed account'} disappears from the room for everyone.`,
    confirmLabel: 'Delete message',
    danger: true,
    action: () => api(`/admin/chat/messages/${r.message.id}/delete`, { method: 'POST', body: {} }),
  };
}

function resolveRequest(r: ChatReportView, status: 'actioned' | 'dismissed'): ConfirmRequest {
  return {
    title: status === 'actioned' ? 'Mark as actioned' : 'Dismiss the report',
    effect:
      status === 'actioned'
        ? 'The report leaves the open queue as handled.'
        : 'The report leaves the open queue without any action against the author.',
    confirmLabel: status === 'actioned' ? 'Mark actioned' : 'Dismiss',
    ask: { label: 'Note (optional)', minLength: 0 },
    action: (note) =>
      api(`/admin/moderation/reports/${r.id}/resolve`, {
        method: 'POST',
        body: { status, ...(note === '' ? {} : { note }) },
      }),
  };
}

function Report(p: {
  readonly r: ChatReportView;
  readonly open: (c: ConfirmRequest) => void;
}): ReactElement {
  const { r, open } = p;
  return (
    <li className="smg-panel smg-panel--inset smg-stack">
      <p>
        <strong>{r.message.author ?? 'removed account'}</strong>:{' '}
        {r.message.text ?? <em>deleted</em>}
      </p>
      <p className="smg-muted">
        Reported by {r.reporter ?? 'a removed account'} · {new Date(r.at).toLocaleString()} ·{' '}
        {r.reason}
      </p>
      {r.status !== 'open' ? null : (
        <div className="smg-row">
          {r.message.text === null ? null : (
            <button
              type="button"
              className="smg-btn smg-btn--danger"
              onClick={() => {
                open(deleteRequest(r));
              }}
            >
              Delete message
            </button>
          )}
          <button
            type="button"
            className="smg-btn"
            onClick={() => {
              open(resolveRequest(r, 'actioned'));
            }}
          >
            Mark actioned
          </button>
          <button
            type="button"
            className="smg-btn"
            onClick={() => {
              open(resolveRequest(r, 'dismissed'));
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </li>
  );
}

export function ReportsPanel(): ReactElement {
  const [status, setStatus] = useState<Status>('open');
  const [items, setItems] = useState<readonly ChatReportView[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await api<{ items: ChatReportView[] }>(
        `/admin/moderation/reports?status=${status}`,
      );
      setItems(r.items);
      setProblem(null);
    } catch (e: unknown) {
      setProblem(failureText(e, 'Loading the reports'));
    }
  }, [status]);
  const [dialog, open] = useConfirm(() => void load());
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="smg-panel smg-stack" aria-label="Reports">
      <label className="smg-field">
        <span>Status</span>
        <select
          className="smg-select"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as Status);
          }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      {problem === null ? null : <p role="alert">{problem}</p>}
      {items === null ? null : items.length === 0 ? (
        <p>No {status} reports.</p>
      ) : (
        <ul className="smg-stack admin-list">
          {items.map((r) => (
            <Report key={r.id} r={r} open={open} />
          ))}
        </ul>
      )}
      {dialog}
    </section>
  );
}
