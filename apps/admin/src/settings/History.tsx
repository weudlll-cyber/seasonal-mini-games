/**
 * @file   apps/admin/src/settings/History.tsx
 * @module admin/settings
 * @brief  A settings document's history: every version with its diff, and rollback.
 *
 * Responsibility: list the versions (`GET /admin/settings/:id/versions`, newest first) with
 *                 who saved each, when, its comment and what it changed against the version
 *                 before, as "key: before → after" (the server computes the diff), and version
 *                 1, the catalogue defaults, at the end; roll back
 *                 to an earlier version through the confirm dialog with a comment (`POST
 *                 …/rollback`: a new version, history stays; a newer version meanwhile is
 *                 refused and the document reloaded).
 * Depends on:     react, @smg/contracts (SettingsVersionView), @smg/game-sdk (types),
 *                 ../ConfirmDialog, ../http
 * Used by:        ./SettingsPage
 * Spec:           docs/spec/08-admin-settings.md §1; Bingo 11 §1
 */
import type { SettingsVersionView } from '@smg/contracts';
import type { SettingOverride } from '@smg/game-sdk';
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { useConfirm, type ConfirmRequest } from '../ConfirmDialog.js';
import { api } from '../http.js';

// "300 (lowest 2, highest 800)"; no override is the catalogue's default.
function overrideText(o: SettingOverride | null): string {
  if (o === null) return 'catalogue default';
  const bounds = [
    o.min === undefined ? null : `lowest ${String(o.min)}`,
    o.max === undefined ? null : `highest ${String(o.max)}`,
  ].filter((b) => b !== null);
  const value = o.value === undefined ? 'catalogue default' : JSON.stringify(o.value);
  return bounds.length === 0 ? value : `${value} (${bounds.join(', ')})`;
}

interface HistoryProps {
  readonly id: string;
  readonly current: number;
  readonly canEdit: boolean;
  // A rollback saved a new version: the document reloads.
  readonly changed: () => void;
}

function rollbackRequest(p: HistoryProps, to: number): ConfirmRequest {
  return {
    title: `Roll back to version ${String(to)}`,
    effect: `A new version ${String(p.current + 1)} is saved with the values of version ${String(to)}; the history stays as it is.`,
    confirmLabel: 'Roll back',
    danger: true,
    ask: { label: 'Comment (goes into the audit log)', minLength: 3 },
    action: (comment) =>
      api(`/admin/settings/${p.id}/rollback`, {
        method: 'POST',
        body: { version: p.current, toVersion: to, comment },
      }),
  };
}

function Version(p: {
  readonly v: SettingsVersionView;
  readonly props: HistoryProps;
  readonly open: (r: ConfirmRequest) => void;
}): ReactElement {
  const { v, props } = p;
  return (
    <li className="smg-stack" data-testid={`version-${String(v.version)}`}>
      <div className="smg-row">
        <strong>Version {v.version}</strong>
        <span className="smg-muted">
          {new Date(v.createdAt).toLocaleString()} · {v.by ?? 'unknown'}
          {v.comment === null ? '' : ` · ${v.comment}`}
        </span>
        {props.canEdit && v.version !== props.current ? (
          <button
            type="button"
            className="smg-btn"
            onClick={() => {
              p.open(rollbackRequest(props, v.version));
            }}
          >
            Roll back to this version
          </button>
        ) : null}
      </div>
      {v.changes.length === 0 ? (
        <p className="smg-muted">No change.</p>
      ) : (
        <ul className="admin-diff">
          {v.changes.map((c) => (
            <li key={c.key}>
              <code>{c.key}</code>: {overrideText(c.before)} → {overrideText(c.after)}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// Version 1 is never stored: every key at its catalogue default (a rollback target too).
function FirstVersion(p: {
  readonly props: HistoryProps;
  readonly open: (r: ConfirmRequest) => void;
}): ReactElement {
  return (
    <li className="smg-row" data-testid="version-1">
      <strong>Version 1</strong>
      <span className="smg-muted">every key at its catalogue default</span>
      {p.props.canEdit ? (
        <button
          type="button"
          className="smg-btn"
          onClick={() => {
            p.open(rollbackRequest(p.props, 1));
          }}
        >
          Roll back to this version
        </button>
      ) : null}
    </li>
  );
}

export function History(props: HistoryProps): ReactElement {
  const [items, setItems] = useState<readonly SettingsVersionView[] | null>(null);
  const load = useCallback(async () => {
    const r = await api<{ items: SettingsVersionView[] }>(`/admin/settings/${props.id}/versions`);
    setItems(r.items);
  }, [props.id]);
  const { changed } = props;
  const [dialog, open] = useConfirm(() => {
    changed();
  });
  useEffect(() => {
    void load();
  }, [load, props.current]);
  if (items === null) return <p className="smg-muted">Loading the history…</p>;
  return (
    <section className="smg-stack" aria-label="History">
      <h3>History</h3>
      {items.length === 0 ? (
        <p>This document was never changed: every key has its catalogue default.</p>
      ) : (
        <ol className="admin-history">
          {items.map((v) => (
            <Version key={v.version} v={v} props={props} open={open} />
          ))}
          <FirstVersion props={props} open={open} />
        </ol>
      )}
      {dialog}
    </section>
  );
}
