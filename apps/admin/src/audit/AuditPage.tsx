/**
 * @file   apps/admin/src/audit/AuditPage.tsx
 * @module admin/audit
 * @brief  The audit log: every admin write, newest first, and a check of its hash chain.
 *
 * Responsibility: list entries 50 at a time (when, who with which roles, what, on what, the
 *                 change), filtered by action, with "older" to page back; "Check the chain"
 *                 asks the server to verify every link and names the first broken entry, if
 *                 any (05 §8, DECISIONS T24). Read-only: the log is append-only.
 * Depends on:     react, @smg/contracts, ../http, ../TextInput
 * Used by:        ../App
 * Spec:           docs/spec/05-security-threat-model.md §8; Bingo 11 §3
 */
import type { AuditEntryView } from '@smg/contracts';
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { api } from '../http.js';
import { TextInput } from '../TextInput.js';

function AuditTable({ items }: { readonly items: readonly AuditEntryView[] }): ReactElement {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table" data-testid="audit-table">
        <thead>
          <tr>
            {['When', 'Who', 'Action', 'Target', 'Change'].map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.occurredAt).toLocaleString()}</td>
              <td>
                {e.actor ?? 'system'} <small className="smg-muted">{e.actorRoles.join(', ')}</small>
              </td>
              <td>{e.action}</td>
              <td>
                {e.targetType} {e.targetId ?? ''}
              </td>
              <td>
                <code className="admin-diff">{JSON.stringify(e.diff)}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function chainText(brokenAt: number): string {
  if (brokenAt < 0) return 'The chain is intact.';
  return `The chain breaks at entry ${String(brokenAt + 1)}, counted from the oldest.`;
}

export function AuditPage(): ReactElement {
  const [items, setItems] = useState<readonly AuditEntryView[]>([]);
  const [action, setAction] = useState('');
  const [chain, setChain] = useState<string | null>(null);
  const load = useCallback(
    async (before?: string) => {
      const q = new URLSearchParams({ limit: '50' });
      if (action.trim() !== '') q.set('action', action.trim());
      if (before !== undefined) q.set('before', before);
      const page = (await api<{ items: AuditEntryView[] }>(`/admin/audit?${q.toString()}`)).items;
      setItems((old) => (before === undefined ? page : [...old, ...page]));
    },
    [action],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const verify = (): void => {
    // The server names the position of the first broken link in log order, -1 when intact.
    void api<{ brokenAt: number }>('/admin/audit/verify').then((r) => {
      setChain(chainText(r.brokenAt));
    });
  };
  return (
    <section className="smg-panel smg-stack">
      <h1>Audit log</h1>
      <div className="smg-row">
        <TextInput
          label="Filter by action"
          placeholder="action, e.g. settings.update"
          value={action}
          onChange={setAction}
        />
        <button type="button" className="smg-btn" onClick={verify} data-testid="verify-chain">
          Check the chain
        </button>
        {chain === null ? null : <span role="status">{chain}</span>}
      </div>
      <AuditTable items={items} />
      {items.length >= 50 ? (
        <button type="button" className="smg-btn" onClick={() => void load(items.at(-1)?.id)}>
          Older
        </button>
      ) : null}
    </section>
  );
}
