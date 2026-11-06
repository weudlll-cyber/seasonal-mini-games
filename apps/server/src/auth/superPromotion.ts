/**
 * @file   apps/server/src/auth/superPromotion.ts
 * @module server/auth
 * @brief  Website mode: make an existing website account the super admin (`smg admin promote-super`).
 *
 * Responsibility: a website install has no local accounts that could sign in, so its first
 *                 admin is a website member who has signed in once (which makes the linked
 *                 account, ./websiteAccounts). Found by website user id, or by name — the game
 *                 name or the website name, case-insensitively — among the accounts linked
 *                 through the website's `proxy_header` provider (the site origin). Several
 *                 members with that name, an unknown member or a suspended account are refused
 *                 with what was found. The role is granted as `manual`, so the role mapping
 *                 recomputed at every sign-in (`idp_mapping` only) keeps it (DECISIONS T243);
 *                 the account's sessions end, so its next sign-in opens an admin session.
 * Depends on:     ../db/pool, ../admin/accountsAdmin, ./sessions
 * Used by:        ../cli
 * Spec:           docs/spec/07-integration.md §7; Bingo 09 §4, §5; Bingo 03 §5
 */
import { addRole } from '../admin/accountsAdmin.js';
import type { DbPool } from '../db/pool.js';
import { revokeAccountSessions } from './sessions.js';

export type PromoteTarget = { readonly websiteId: string } | { readonly name: string };

export interface WebsiteMember {
  readonly accountId: string;
  readonly websiteId: string;
  readonly displayName: string;
}

export type PromoteResult =
  | { readonly kind: 'promoted' | 'already' | 'suspended'; readonly member: WebsiteMember }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'ambiguous'; readonly members: readonly WebsiteMember[] };

interface Row {
  readonly account_id: string;
  readonly subject: string;
  readonly display_name: string;
  readonly status: string;
  readonly is_super: boolean;
}

// The website-linked accounts the target names (the subject is the website user id).
async function candidates(pool: DbPool, issuer: string, target: PromoteTarget) {
  const websiteId = 'websiteId' in target ? target.websiteId : null;
  const name = 'name' in target ? target.name.trim() : null;
  const r = await pool.query<Row>(
    `SELECT a.id::text AS account_id, e.subject, a.display_name, a.status,
       EXISTS (SELECT 1 FROM smg.role_assignments r
                WHERE r.account_id = a.id AND r.role_id = 'super_admin') AS is_super
     FROM smg.external_identities e
     JOIN smg.identity_providers p ON p.id = e.provider_id
     JOIN smg.accounts a ON a.id = e.account_id
     WHERE p.issuer = $1 AND p.kind = 'proxy_header' AND a.status <> 'deleted'
       AND (e.subject = $2 OR a.display_name_key = $3::citext
            OR lower(e.last_claims->>'name') = lower($3))
     ORDER BY length(e.subject), e.subject`,
    [issuer, websiteId, name],
  );
  return r.rows;
}

const memberOf = (row: Row): WebsiteMember => ({
  accountId: row.account_id,
  websiteId: row.subject,
  displayName: row.display_name,
});

// Grants super_admin to the one website account the target names, or says why not.
export async function promoteWebsiteSuper(
  pool: DbPool,
  issuer: string,
  target: PromoteTarget,
): Promise<PromoteResult> {
  const rows = await candidates(pool, issuer, target);
  const [row] = rows;
  if (row === undefined) return { kind: 'unknown' };
  if (rows.length > 1) return { kind: 'ambiguous', members: rows.map(memberOf) };
  const member = memberOf(row);
  if (row.status !== 'active') return { kind: 'suspended', member };
  if (row.is_super) return { kind: 'already', member };
  await addRole(pool, { accountId: row.account_id, role: 'super_admin', grantedBy: null });
  await revokeAccountSessions(pool, row.account_id);
  return { kind: 'promoted', member };
}
