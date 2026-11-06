/**
 * @file   apps/server/src/integration/accountChanges.ts
 * @module server/integration
 * @brief  What one change of the website's account-changes feed does to the game account (O66).
 *
 * Responsibility: the change names a website user id; the game account linked to it through
 *                 the website's `proxy_header` provider (the site origin) is found, or the change
 *                 means nothing here. `deleted`: the account is anonymised — "Deleted player",
 *                 status `deleted`, no roles, no steps, no link to the website — so its points
 *                 stay in past rounds under that name while the boards, which skip deleted
 *                 accounts, drop it (DECISIONS T216); its sessions end. `locked`: its sessions
 *                 end. `rights`: its sessions end, so the next sign-in recomputes the roles.
 *                 `unlocked`: nothing (the website lets the member in again). Each change is
 *                 safe to apply twice. Returns the ended sessions, whose sockets then close.
 * Depends on:     zod, pg (types), ../db/pool, ../auth/sessions
 * Used by:        ./accountFeed
 * Spec:           docs/spec/07-integration.md §7; docs/spec/06-data-model-api-realtime.md §2.9
 */
import type pg from 'pg';
import { z } from 'zod';

import { revokeAccountSessions } from '../auth/sessions.js';
import { inTransaction, type DbPool } from '../db/pool.js';

export const AccountChange = z.object({
  id: z.number().int().nonnegative(),
  kind: z.enum(['deleted', 'locked', 'unlocked', 'rights']),
});
export type AccountChange = z.infer<typeof AccountChange>;

// The name every deleted website account shows in past rounds (O66).
const DELETED_NAME = 'Deleted player';

async function linkedAccount(c: pg.PoolClient, issuer: string, subject: string) {
  const r = await c.query<{ account_id: string }>(
    `SELECT e.account_id::text FROM smg.external_identities e
       JOIN smg.identity_providers p ON p.id = e.provider_id
      WHERE p.issuer = $1 AND p.kind = 'proxy_header' AND e.subject = $2`,
    [issuer, subject],
  );
  return r.rows[0]?.account_id ?? null;
}

// The account keeps its id, so round results and match players still name it, but nothing
// of the member: the name key is unique per account, the shown name is the same for all.
async function anonymise(c: pg.PoolClient, accountId: string): Promise<void> {
  await c.query(
    `UPDATE smg.accounts SET status = 'deleted', display_name = $2,
       display_name_key = 'deleted-' || id::text, email = NULL, email_verified_at = NULL,
       password_hash = NULL, steps = '[]', updated_at = now()
     WHERE id = $1`,
    [accountId, DELETED_NAME],
  );
  await c.query('DELETE FROM smg.role_assignments WHERE account_id = $1', [accountId]);
  await c.query('DELETE FROM smg.external_identities WHERE account_id = $1', [accountId]);
}

// Applies one change; the sessions it ended.
export async function applyAccountChange(
  pool: DbPool,
  issuer: string,
  change: AccountChange,
): Promise<string[]> {
  if (change.kind === 'unlocked') return [];
  return inTransaction(pool, async (c) => {
    const accountId = await linkedAccount(c, issuer, String(change.id));
    if (accountId === null) return [];
    if (change.kind === 'deleted') await anonymise(c, accountId);
    return revokeAccountSessions(c, accountId);
  });
}
