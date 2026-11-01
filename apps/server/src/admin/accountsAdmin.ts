/**
 * @file   apps/server/src/admin/accountsAdmin.ts
 * @module server/admin
 * @brief  Account administration: search, suspend and restore, assign and remove roles.
 *
 * Responsibility: the queries behind the admin Players screen (Bingo 11 §3.6): search by
 *                 display name (e-mail is personal data and is not shown), with roles and
 *                 the 7-day abuse score; status changes; role changes. The routes check
 *                 permissions, the separation rules and write the audit entries.
 * Depends on:     @smg/contracts (AccountView), ../db/pool, ./abuse (score window)
 * Used by:        ../http/routes/adminAccounts
 * Spec:           docs/spec/05-security-threat-model.md §1; Bingo 03 §5.3, Bingo 11 §3.6
 */
import type { AccountView } from '@smg/contracts';

import type { DbPool } from '../db/pool.js';
import { SCORE_WINDOW } from './abuse.js';

interface AccountRow {
  id: string;
  display_name: string;
  status: 'active' | 'suspended';
  roles: string[] | null;
  created_at: Date;
  score: number;
}

export async function searchAccounts(pool: DbPool, query: string): Promise<AccountView[]> {
  const r = await pool.query<AccountRow>(
    `SELECT a.id, a.display_name, a.status, a.created_at,
       (SELECT array_agg(ra.role_id ORDER BY ra.role_id) FROM smg.role_assignments ra
          WHERE ra.account_id = a.id) AS roles,
       (SELECT COALESCE(sum(s.weight), 0)::int FROM smg.abuse_signals s
          WHERE s.account_id = a.id AND s.at > now() - $2::interval) AS score
     FROM smg.accounts a
     WHERE a.status <> 'deleted' AND ($1 = '' OR a.display_name_key LIKE '%' || $1 || '%')
     ORDER BY a.display_name_key LIMIT 50`,
    [query.toLowerCase(), SCORE_WINDOW],
  );
  return r.rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    status: row.status,
    roles: row.roles ?? [],
    createdAt: row.created_at.toISOString(),
    abuseScore: row.score,
  }));
}

export async function rolesOf(pool: DbPool, accountId: string): Promise<string[] | null> {
  const r = await pool.query<{ roles: string[] | null }>(
    `SELECT (SELECT array_agg(role_id ORDER BY role_id) FROM smg.role_assignments
               WHERE account_id = a.id) AS roles
     FROM smg.accounts a WHERE a.id = $1 AND a.status <> 'deleted'`,
    [accountId],
  );
  const row = r.rows[0];
  return row === undefined ? null : (row.roles ?? []);
}

// true when the status changed.
export async function setStatus(
  pool: DbPool,
  accountId: string,
  status: 'active' | 'suspended',
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE smg.accounts SET status = $2, updated_at = now()
     WHERE id = $1 AND status IN ('active', 'suspended') AND status <> $2`,
    [accountId, status],
  );
  return r.rowCount === 1;
}

export async function addRole(
  pool: DbPool,
  input: { readonly accountId: string; readonly role: string; readonly grantedBy: string | null },
): Promise<boolean> {
  const r = await pool.query(
    `INSERT INTO smg.role_assignments (account_id, role_id, granted_by)
     SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM smg.roles WHERE id = $2)
     ON CONFLICT DO NOTHING`,
    [input.accountId, input.role, input.grantedBy],
  );
  return r.rowCount === 1;
}

export async function removeRole(pool: DbPool, accountId: string, role: string): Promise<boolean> {
  const r = await pool.query(
    'DELETE FROM smg.role_assignments WHERE account_id = $1 AND role_id = $2',
    [accountId, role],
  );
  return r.rowCount === 1;
}
