/**
 * @file   apps/admin/src/accounts/AccountsPage.tsx
 * @module admin/accounts
 * @brief  The Accounts area: search by display name, roles, suspend and restore.
 *
 * Responsibility: search accounts (`GET /admin/accounts?query=`: name, status, roles, abuse
 *                 score; no e-mail); with `role.assign` assign or remove a role with a reason;
 *                 with `account.suspend` suspend (signs the account out everywhere) or restore
 *                 it with a reason. Every change goes through the confirm dialog with its
 *                 effect in one sentence; the server checks the rules again (never oneself, a
 *                 super admin only by a super admin).
 * Depends on:     react, @smg/contracts (AccountView), ../ConfirmDialog, ../http, ../TextInput
 * Used by:        ../App
 * Spec:           docs/spec/05-security-threat-model.md §1; Bingo 11 §1, §3.6; Bingo 03 §5.3
 */
import type { AccountView } from '@smg/contracts';
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { useConfirm, type ConfirmRequest } from '../ConfirmDialog.js';
import { api } from '../http.js';
import { TextInput } from '../TextInput.js';

// The roles of smg.roles a staff member may hand out (player is every account's own).
const ROLES = ['organizer', 'moderator', 'game_admin', 'security_admin', 'super_admin'];
const REASON = { label: 'Reason (goes into the audit log)', minLength: 3 };

export interface AccountRights {
  readonly suspend: boolean;
  readonly roles: boolean;
}

const post = (path: string, body: object) => api(path, { method: 'POST', body });

function suspendRequest(a: AccountView): ConfirmRequest {
  const suspend = a.status === 'active';
  return {
    title: `${suspend ? 'Suspend' : 'Restore'} ${a.displayName}`,
    effect: suspend
      ? `${a.displayName} is signed out everywhere and cannot sign in until restored.`
      : `${a.displayName} can sign in and play again.`,
    confirmLabel: suspend ? 'Suspend' : 'Restore',
    danger: suspend,
    ask: REASON,
    action: (reason) =>
      post(`/admin/accounts/${a.id}/${suspend ? 'suspend' : 'unsuspend'}`, { reason }),
  };
}

function roleRequest(a: AccountView, role: string): ConfirmRequest {
  const has = a.roles.includes(role);
  return {
    title: `${has ? 'Remove' : 'Assign'} ${role}`,
    effect: has
      ? `${a.displayName} loses the rights of ${role} from the next request on.`
      : `${a.displayName} gets the rights of ${role} from the next request on.`,
    confirmLabel: has ? 'Remove role' : 'Assign role',
    danger: has || role === 'super_admin',
    ask: REASON,
    action: (reason) =>
      post(`/admin/accounts/${a.id}/roles${has ? '/remove' : ''}`, { role, reason }),
  };
}

function Row(p: {
  readonly a: AccountView;
  readonly rights: AccountRights;
  readonly open: (r: ConfirmRequest) => void;
}): ReactElement {
  const { a, rights, open } = p;
  return (
    <tr data-testid={`account-${a.displayName}`}>
      <td>{a.displayName}</td>
      <td>{a.status}</td>
      <td>
        {rights.roles ? (
          <div className="smg-row">
            {ROLES.map((role) => (
              <button
                key={role}
                type="button"
                className="smg-btn"
                aria-pressed={a.roles.includes(role)}
                onClick={() => {
                  open(roleRequest(a, role));
                }}
              >
                {role}
              </button>
            ))}
          </div>
        ) : (
          a.roles.join(', ')
        )}
      </td>
      <td>{a.abuseScore}</td>
      <td>{new Date(a.createdAt).toLocaleDateString()}</td>
      {rights.suspend ? (
        <td>
          <button
            type="button"
            className="smg-btn"
            onClick={() => {
              open(suspendRequest(a));
            }}
          >
            {a.status === 'active' ? 'Suspend' : 'Restore'}
          </button>
        </td>
      ) : null}
    </tr>
  );
}

export function AccountsPage({ rights }: { readonly rights: AccountRights }): ReactElement {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<readonly AccountView[] | null>(null);
  const search = useCallback(async () => {
    const q = encodeURIComponent(query.trim());
    setItems((await api<{ items: AccountView[] }>(`/admin/accounts?query=${q}`)).items);
  }, [query]);
  const [dialog, open] = useConfirm(() => void search());
  useEffect(() => {
    const timer = setTimeout(() => void search(), 250);
    return () => {
      clearTimeout(timer);
    };
  }, [search]);
  const columns = [
    'Name',
    'Status',
    'Roles',
    'Abuse score',
    'Since',
    ...(rights.suspend ? ['Action'] : []),
  ];
  return (
    <section className="smg-panel smg-stack">
      <h1>Accounts</h1>
      <TextInput label="Search by name" visible value={query} onChange={setQuery} maxLength={40} />
      {items === null ? (
        <p className="smg-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p>No account matches.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table" data-testid="accounts-table">
            <thead>
              <tr>
                {columns.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <Row key={a.id} a={a} rights={rights} open={open} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialog}
    </section>
  );
}
