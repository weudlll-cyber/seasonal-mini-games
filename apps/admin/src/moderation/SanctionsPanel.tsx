/**
 * @file   apps/admin/src/moderation/SanctionsPanel.tsx
 * @module admin/moderation
 * @brief  Mutes and bans of the builtin chat: the list, a new sanction, lifting one.
 *
 * Responsibility: every sanction (`GET /admin/chat/sanctions`) with whom, kind, scope, reason,
 *                 by whom and until when; a new mute (5 minutes, an hour or a day) or ban,
 *                 everywhere or in one room, with a reason (`POST /admin/chat/sanctions`); lift
 *                 one (`POST …/:id/lift`). Both through the confirm dialog with the effect in
 *                 one sentence.
 * Depends on:     react, @smg/contracts (ChatSanctionView), ../ConfirmDialog, ../http, ../TextInput
 * Used by:        ./ModerationPage
 * Spec:           Bingo 11 §1, §3.5; Bingo 03 §12; Bingo 05 §3
 */
import type { ChatSanctionView } from '@smg/contracts';
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { useConfirm, type ConfirmRequest } from '../ConfirmDialog.js';
import { api, failureText } from '../http.js';
import { TextInput } from '../TextInput.js';

const DURATIONS = [
  { minutes: 5, label: '5 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 1440, label: '1 day' },
] as const;
const REASON = { label: 'Reason (goes into the audit log)', minLength: 3 };

const until = (s: ChatSanctionView) => {
  if (s.liftedAt !== null) return `lifted ${new Date(s.liftedAt).toLocaleString()}`;
  return s.expiresAt === null ? 'until lifted' : `until ${new Date(s.expiresAt).toLocaleString()}`;
};

function liftRequest(s: ChatSanctionView): ConfirmRequest {
  return {
    title: `Lift the ${s.kind} of ${s.displayName}`,
    effect: `${s.displayName} may write in ${s.scope === 'global' ? 'every room' : 'this room'} again at once.`,
    confirmLabel: 'Lift',
    danger: true,
    action: () => api(`/admin/chat/sanctions/${s.id}/lift`, { method: 'POST', body: {} }),
  };
}

interface Draft {
  readonly name: string;
  readonly kind: 'mute' | 'ban';
  readonly minutes: number;
  // 'global', or one room's id.
  readonly where: string;
}

function sanctionRequest({ name, kind, minutes, where }: Draft): ConfirmRequest {
  return {
    title: `${kind === 'ban' ? 'Ban' : 'Mute'} ${name}`,
    effect:
      kind === 'ban'
        ? `${name} can no longer write in ${where === 'global' ? 'any room' : 'this room'} until the ban is lifted.`
        : `${name} cannot write in ${where === 'global' ? 'any room' : 'this room'} for ${String(minutes)} minutes.`,
    confirmLabel: kind === 'ban' ? 'Ban' : 'Mute',
    danger: true,
    ask: REASON,
    action: (reason) =>
      api('/admin/chat/sanctions', {
        method: 'POST',
        body: {
          displayName: name.trim(),
          kind,
          scope: where,
          minutes: kind === 'ban' ? null : minutes,
          reason,
        },
      }),
  };
}

function Duration(p: {
  readonly minutes: number;
  readonly set: (m: number) => void;
}): ReactElement {
  return (
    <label className="smg-field">
      <span>For</span>
      <select
        className="smg-select"
        value={p.minutes}
        onChange={(e) => {
          p.set(Number(e.target.value));
        }}
      >
        {DURATIONS.map((d) => (
          <option key={d.minutes} value={d.minutes}>
            {d.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NewSanction({ open }: { readonly open: (r: ConfirmRequest) => void }): ReactElement {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'mute' | 'ban'>('mute');
  const [minutes, setMinutes] = useState(60);
  const [scope, setScope] = useState('');
  const where = scope.trim() === '' ? 'global' : scope.trim();
  return (
    <div className="smg-row">
      <TextInput label="Display name" visible value={name} onChange={setName} maxLength={24} />
      <label className="smg-field">
        <span>Kind</span>
        <select
          className="smg-select"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as 'mute' | 'ban');
          }}
        >
          <option value="mute">mute</option>
          <option value="ban">ban</option>
        </select>
      </label>
      {kind === 'mute' ? <Duration minutes={minutes} set={setMinutes} /> : null}
      <TextInput
        label="Room id (empty: every room)"
        visible
        value={scope}
        onChange={setScope}
        maxLength={36}
      />
      <button
        type="button"
        className="smg-btn smg-btn--danger"
        disabled={name.trim().length < 3}
        onClick={() => {
          open(sanctionRequest({ name, kind, minutes, where }));
        }}
      >
        {kind === 'ban' ? 'Ban' : 'Mute'}
      </button>
    </div>
  );
}

function Rows(p: {
  readonly items: readonly ChatSanctionView[];
  readonly open: (r: ConfirmRequest) => void;
}): ReactElement {
  const { items, open } = p;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table" data-testid="sanctions-table">
        <thead>
          <tr>
            {['Player', 'Kind', 'Where', 'Reason', 'By', 'Until', 'Action'].map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              <td>{s.displayName}</td>
              <td>{s.kind}</td>
              <td>{s.scope === 'global' ? 'every room' : s.scope}</td>
              <td>{s.reason}</td>
              <td>{s.by ?? '—'}</td>
              <td>{until(s)}</td>
              <td>
                {s.liftedAt === null ? (
                  <button
                    type="button"
                    className="smg-btn"
                    onClick={() => {
                      open(liftRequest(s));
                    }}
                  >
                    Lift
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SanctionsPanel(): ReactElement {
  const [items, setItems] = useState<readonly ChatSanctionView[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setItems((await api<{ items: ChatSanctionView[] }>('/admin/chat/sanctions')).items);
      setProblem(null);
    } catch (e: unknown) {
      setProblem(failureText(e, 'Loading the sanctions'));
    }
  }, []);
  const [dialog, open] = useConfirm(() => void load());
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="smg-panel smg-stack" aria-label="Sanctions">
      <NewSanction open={open} />
      {problem === null ? null : <p role="alert">{problem}</p>}
      {items === null || items.length === 0 ? (
        <p className="smg-muted">No sanctions.</p>
      ) : (
        <Rows items={items} open={open} />
      )}
      {dialog}
    </section>
  );
}
