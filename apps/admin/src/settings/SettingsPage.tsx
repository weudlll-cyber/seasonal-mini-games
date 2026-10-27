/**
 * @file   apps/admin/src/settings/SettingsPage.tsx
 * @module admin/settings
 * @brief  The settings area: every document, every key with default, bounds, who and when.
 *
 * Responsibility: pick a document (platform documents and one per game, 08 §1); show every
 *                 key in a table (./SettingRow); collect the viewer's changes and save them as
 *                 a new version with a comment (`PUT /admin/settings/:id` with the version it
 *                 was read at; a newer version answers "changed meanwhile", 08 §1); a change
 *                 of the security document goes through the confirm dialog first (Bingo 11
 *                 §1). Refusals come back with the setting and the reason in plain words.
 *                 Below the table the document's history with diffs and rollback (./History).
 * Depends on:     react, @smg/contracts, @smg/game-sdk (types), ../ConfirmDialog, ../http,
 *                 ../TextInput, ./History, ./SettingRow, ./settingText
 * Used by:        ../App
 * Spec:           docs/spec/08-admin-settings.md §1–§6; Bingo 11 §1
 */
import type { SettingsDocumentView } from '@smg/contracts';
import type { SettingOverride } from '@smg/game-sdk';
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { useConfirm, type ConfirmRequest } from '../ConfirmDialog.js';
import { api, ApiError } from '../http.js';
import { TextInput } from '../TextInput.js';
import { History } from './History.js';
import { SettingRow } from './SettingRow.js';
import { documentName } from './settingText.js';

type Draft = Record<string, SettingOverride>;
const COLUMNS = [
  'Setting',
  'Default',
  'In force',
  'Min',
  'Max',
  'Who',
  'Running rounds',
  'Source',
  'Change',
];

function problemText(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Saving failed.';
  if (error.code === 'CONFIG_VERSION_CONFLICT') {
    return 'Someone changed this document meanwhile. It was loaded again; please repeat your change.';
  }
  if (error.code === 'FORBIDDEN') return 'You may not change one of these settings.';
  return error.detail ?? 'A value is not allowed.';
}

function Table({
  doc,
  draft,
  setDraft,
}: {
  readonly doc: SettingsDocumentView;
  readonly draft: Draft;
  readonly setDraft: (d: (old: Draft) => Draft) => void;
}): ReactElement {
  // The keys this account may change (the server named them from its permissions).
  const editable = new Set(doc.editable);
  return (
    <div className="admin-table-wrap">
      <table className="admin-table" data-testid="settings-table">
        <thead>
          <tr>
            {COLUMNS.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {doc.defs.map((def) => (
            <SettingRow
              key={def.key}
              def={def}
              value={doc.values[def.key]}
              override={draft[def.key] ?? {}}
              editable={editable.has(def.key)}
              change={(o) => {
                setDraft((d) => ({ ...d, [def.key]: o }));
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A key back to "as catalogue" everywhere is left out of the stored document.
const stored = (draft: Draft): Draft =>
  Object.fromEntries(
    Object.entries(draft).filter(([, o]) => Object.values(o).some((v) => v !== undefined)),
  );

function SaveBar(p: {
  readonly comment: string;
  readonly setComment: (c: string) => void;
  readonly save: () => void;
}): ReactElement {
  return (
    <div className="smg-row">
      <TextInput
        label="Comment"
        placeholder="Why (goes into the audit log)"
        maxLength={200}
        value={p.comment}
        onChange={p.setComment}
      />
      <button
        type="button"
        className="smg-btn smg-btn--primary"
        onClick={p.save}
        data-testid="save-settings"
      >
        Save
      </button>
    </div>
  );
}

function securityRequest(put: () => Promise<unknown>): ConfirmRequest {
  return {
    title: 'Change the security settings',
    effect: 'The new security settings apply to every account from the next request on.',
    confirmLabel: 'Save',
    danger: true,
    action: put,
  };
}

function Document({ id }: { readonly id: string }): ReactElement {
  const [doc, setDoc] = useState<SettingsDocumentView | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    const d = await api<SettingsDocumentView>(`/admin/settings/${id}`);
    setDoc(d);
    setDraft({ ...d.overrides });
  }, [id]);
  const [dialog, open] = useConfirm();
  useEffect(() => {
    void load();
  }, [load]);
  if (doc === null) return <p className="smg-muted">Loading…</p>;
  const put = () =>
    api(`/admin/settings/${id}`, {
      method: 'PUT',
      body: {
        version: doc.version,
        overrides: stored(draft),
        ...(comment === '' ? {} : { comment }),
      },
    }).then(() => {
      setMessage('Saved as a new version.');
      setComment('');
      return load();
    });
  const save = (): void => {
    // Security settings are high-impact: the confirm dialog first (Bingo 11 §1).
    if (id === 'security') {
      open(securityRequest(put));
      return;
    }
    put().catch((error: unknown) => {
      setMessage(problemText(error));
      if (error instanceof ApiError && error.code === 'CONFIG_VERSION_CONFLICT') void load();
    });
  };
  return (
    <section className="smg-panel smg-stack">
      <h2>
        {documentName(id)} <small className="smg-muted">version {doc.version}</small>
      </h2>
      <Table doc={doc} draft={draft} setDraft={setDraft} />
      {doc.editable.length === 0 ? null : (
        <SaveBar comment={comment} setComment={setComment} save={save} />
      )}
      {message === null ? null : <p role="status">{message}</p>}
      <History
        id={id}
        current={doc.version}
        canEdit={doc.editable.length > 0}
        changed={() => void load()}
      />
      {dialog}
    </section>
  );
}

export function SettingsPage(): ReactElement {
  const [ids, setIds] = useState<readonly string[]>([]);
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    void api<{ ids: string[] }>('/admin/settings').then((r) => {
      setIds(r.ids);
      setId((current) => current ?? r.ids[0] ?? null);
    });
  }, []);
  return (
    <div className="smg-stack">
      <h1>Settings</h1>
      <nav className="admin-tabs" aria-label="Documents">
        {ids.map((d) => (
          <button
            key={d}
            type="button"
            className="smg-btn"
            aria-pressed={d === id}
            onClick={() => {
              setId(d);
            }}
          >
            {documentName(d)}
          </button>
        ))}
      </nav>
      {id === null ? null : <Document key={id} id={id} />}
    </div>
  );
}
