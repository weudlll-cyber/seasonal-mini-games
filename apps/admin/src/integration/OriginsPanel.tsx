/**
 * @file   apps/admin/src/integration/OriginsPanel.tsx
 * @module admin/integration
 * @brief  The embed allowlist: the sites that may frame the game, list, add, change, remove.
 *
 * Responsibility: the origins (`GET /admin/embed-origins`) with their label, whether they may
 *                 hand off a sign-in, and when they were added; a form checked with
 *                 EmbedOriginBody adds one or changes a listed one's label and handoff flag
 *                 (the server's save is one call for both; a new origin already listed is
 *                 refused here, so it is changed on purpose only); Remove through the confirm
 *                 dialog. The list has no disabled state: the route has none, an origin is on
 *                 the list or not.
 * Depends on:     react, @smg/contracts (origin view and body), ../ConfirmDialog (type), ../http,
 *                 ../TextInput, ./form, ./useListed
 * Used by:        ./IntegrationPage
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §3.4; Bingo 11 §1
 */
import { EmbedOriginBody, type EmbedOriginView } from '@smg/contracts';
import { useState, type ReactElement, type SyntheticEvent } from 'react';

import type { ConfirmRequest } from '../ConfirmDialog.js';
import { api, failureText } from '../http.js';
import { TextInput } from '../TextInput.js';
import { Checkbox, FormEnd, issueText, NewOrForm, Table } from './form.js';
import { useListed } from './useListed.js';

const LABELS = { origin: 'Origin', label: 'Label', allowAuthHandoff: 'Sign-in handoff' };

const removeRequest = (o: EmbedOriginView): ConfirmRequest => ({
  title: `Remove ${o.origin}`,
  effect: `${o.origin} can no longer frame the game, talk to it or hand off a sign-in; its open frames stop working at their next load.`,
  confirmLabel: 'Remove',
  danger: true,
  action: () =>
    api(`/admin/embed-origins?origin=${encodeURIComponent(o.origin)}`, { method: 'DELETE' }),
});

function OriginForm(p: {
  readonly origin: EmbedOriginView | null;
  readonly listed: readonly EmbedOriginView[];
  readonly done: () => void;
  readonly cancel: () => void;
}): ReactElement {
  const [origin, setOrigin] = useState(p.origin?.origin ?? '');
  const [label, setLabel] = useState(p.origin?.label ?? '');
  const [handoff, setHandoff] = useState(p.origin?.allowAuthHandoff ?? false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = (e: SyntheticEvent): void => {
    e.preventDefault();
    const checked = EmbedOriginBody.safeParse({
      origin: origin.trim(),
      label,
      allowAuthHandoff: handoff,
    });
    if (!checked.success) {
      setProblem(issueText(checked.error.issues, LABELS));
      return;
    }
    if (p.origin === null && p.listed.some((o) => o.origin === checked.data.origin)) {
      setProblem('Origin: already on the list; change it there.');
      return;
    }
    api('/admin/embed-origins', { method: 'POST', body: checked.data })
      .then(p.done)
      .catch((error: unknown) => {
        setProblem(failureText(error, 'Saving the origin'));
      });
  };
  return (
    <form className="smg-panel smg-panel--inset smg-stack" onSubmit={save}>
      <h3>{p.origin === null ? 'New embed origin' : `Change ${p.origin.origin}`}</h3>
      {p.origin === null ? (
        <TextInput
          label="Origin (scheme, host and port, e.g. https://example.org)"
          visible
          value={origin}
          onChange={setOrigin}
          maxLength={300}
        />
      ) : null}
      <TextInput label="Label" visible value={label} onChange={setLabel} maxLength={80} />
      <Checkbox
        label="May hand off a sign-in (JWT handoff from this site)"
        checked={handoff}
        onChange={setHandoff}
      />
      <FormEnd saveLabel="Save origin" problem={problem} cancel={p.cancel} />
    </form>
  );
}

function OriginsTable(p: {
  readonly origins: readonly EmbedOriginView[];
  readonly edit: (o: EmbedOriginView) => void;
  readonly open: (r: ConfirmRequest) => void;
}): ReactElement {
  return (
    <Table head={['Origin', 'Label', 'Sign-in handoff', 'Added', 'Actions']}>
      {p.origins.map((o) => (
        <tr key={o.origin} data-testid={`origin-${o.origin}`}>
          <td className="admin-diff">{o.origin}</td>
          <td>{o.label}</td>
          <td>{o.allowAuthHandoff ? 'allowed' : 'no'}</td>
          <td>{new Date(o.createdAt).toLocaleString()}</td>
          <td className="smg-row">
            <button
              type="button"
              className="smg-btn"
              onClick={() => {
                p.edit(o);
              }}
            >
              Change
            </button>
            <button
              type="button"
              className="smg-btn smg-btn--danger"
              onClick={() => {
                p.open(removeRequest(o));
              }}
            >
              Remove
            </button>
          </td>
        </tr>
      ))}
    </Table>
  );
}

export function OriginsPanel(): ReactElement {
  const list = useListed<{ origins: EmbedOriginView[] }>('/admin/embed-origins');
  const origins = list.data?.origins ?? null;
  const [editing, setEditing] = useState<EmbedOriginView | 'new' | null>(null);
  const form =
    editing === null ? null : (
      <OriginForm
        key={editing === 'new' ? 'new' : editing.origin}
        origin={editing === 'new' ? null : editing}
        listed={origins ?? []}
        done={() => {
          setEditing(null);
          void list.load();
        }}
        cancel={() => {
          setEditing(null);
        }}
      />
    );
  return (
    <section className="smg-panel smg-stack" aria-label="Embed origins">
      <h2>Embed origins</h2>
      <p className="smg-muted">
        Sites that may frame the game. The list drives frame-ancestors, the frames&apos; messages,
        the socket&apos;s Origin check and the public API&apos;s CORS.
      </p>
      {origins === null ? <p className="smg-muted">Loading…</p> : null}
      {origins?.length === 0 ? <p>No site may frame the game.</p> : null}
      {origins === null || origins.length === 0 ? null : (
        <OriginsTable origins={origins} edit={setEditing} open={list.open} />
      )}
      <NewOrForm
        label="New embed origin"
        form={form}
        start={() => {
          setEditing('new');
        }}
      />
      {list.dialog}
    </section>
  );
}
