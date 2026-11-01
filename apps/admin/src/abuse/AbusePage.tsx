/**
 * @file   apps/admin/src/abuse/AbusePage.tsx
 * @module admin/abuse
 * @brief  The abuse view for moderators: accounts by abuse score, with their recent signals.
 *
 * Responsibility: every account with signals in the last 7 days, highest score first, with
 *                 the latest signals in plain words (05 §7, DECISIONS T25); a score never
 *                 sanctions by itself (S5) — a security admin may suspend an account with a
 *                 reason, which ends its sessions and is audited.
 * Depends on:     react, @smg/contracts, ../http, ../TextInput
 * Used by:        ../App
 * Spec:           docs/spec/05-security-threat-model.md §2, §7; docs/spec/08-admin-settings.md §6
 */
import type { AbuseRowView } from '@smg/contracts';
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { api, ApiError } from '../http.js';
import { TextInput } from '../TextInput.js';

const KINDS: Readonly<Record<string, string>> = {
  loginFailed: 'failed sign-in',
  rateLimited: 'guess flood',
  cooldownRejects: 'many cooldown refusals',
};

function Suspend({
  row,
  done,
}: {
  readonly row: AbuseRowView;
  readonly done: () => void;
}): ReactElement {
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const suspend = (): void => {
    api(`/admin/accounts/${row.accountId}/suspend`, { method: 'POST', body: { reason } })
      .then(done)
      .catch((e: unknown) => {
        setProblem(e instanceof ApiError ? `Not suspended (${e.code}).` : 'Not suspended.');
      });
  };
  return (
    <div className="smg-row">
      <TextInput
        label={`Reason to suspend ${row.displayName}`}
        placeholder="Reason"
        value={reason}
        onChange={setReason}
      />
      <button
        type="button"
        className="smg-btn smg-btn--danger"
        disabled={reason.trim().length < 3}
        onClick={suspend}
      >
        Suspend
      </button>
      {problem === null ? null : <span role="alert">{problem}</span>}
    </div>
  );
}

export function AbusePage({ canSuspend }: { readonly canSuspend: boolean }): ReactElement {
  const [rows, setRows] = useState<readonly AbuseRowView[] | null>(null);
  const load = useCallback(async () => {
    setRows((await api<{ items: AbuseRowView[] }>('/admin/abuse')).items);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="smg-panel smg-stack">
      <h1>Abuse</h1>
      <p className="smg-muted">
        Scores add up the weighted signals of the last 7 days. A score never sanctions by itself.
      </p>
      {rows === null ? (
        <p className="smg-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p>No signals in the last 7 days.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table" data-testid="abuse-table">
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Score</th>
                <th scope="col">Recent signals</th>
                {canSuspend ? <th scope="col">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.accountId}>
                  <td>{r.displayName}</td>
                  <td>{r.score}</td>
                  <td>
                    <ul>
                      {r.recent.map((s) => (
                        <li key={`${s.kind}${s.at}`}>
                          {KINDS[s.kind] ?? s.kind} · {new Date(s.at).toLocaleString()}{' '}
                          {s.detail === '' ? '' : `· ${s.detail}`}
                        </li>
                      ))}
                    </ul>
                  </td>
                  {canSuspend ? (
                    <td>
                      <Suspend row={r} done={() => void load()} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
