/**
 * @file   apps/server/src/auth/websiteAccounts.ts
 * @module server/auth
 * @brief  Website mode: the game account of a website member, by (site origin, user id) (O66).
 *
 * Responsibility: in one transaction: the website's identity provider (`proxy_header`, created
 *                 at its first sign-in; a disabled one, or an issuer a JWT provider holds,
 *                 refuses), the external identity and its account — created without password or
 *                 e-mail on the first sign-in, with the `player` role —, the display name
 *                 following the website's (a numeric suffix when another account has it), the
 *                 mapped roles recomputed (`idp_mapping`; game_admin and organizer at most, never
 *                 super_admin or security_admin), the e-mail verification mirrored, the Discord
 *                 steps stored, the last sign-in. A suspended or deleted game account is
 *                 refused. Never links by e-mail. Adapted from Bingo's websiteAccounts.ts.
 * Depends on:     pg (types), ../db/pool, ./accounts, ./websiteIdentity, ../integration/handoff
 * Used by:        ../http/routes/websiteSignIn, ../integration/accountChanges (websiteProvider)
 * Spec:           docs/spec/07-integration.md §7; docs/spec/06-data-model-api-realtime.md §1;
 *                 Bingo 07 §2.1, §2.3
 */
import type pg from 'pg';

import { inTransaction, type DbPool } from '../db/pool.js';
import { applyRoles, nameCandidates } from '../integration/handoff.js';
import { createLinkedAccount } from './accounts.js';
import { mappedRoles, type WebsiteIdentity } from './websiteIdentity.js';

interface Linked {
  readonly account_id: string;
  readonly status: string;
  readonly last_claims: { readonly name?: string };
}

// The website's provider row, made at the first sign-in; null when disabled or when the
// issuer belongs to a JWT handoff provider.
export async function websiteProvider(c: pg.PoolClient | DbPool, issuer: string) {
  const r = await c.query<{ id: string; enabled: boolean; kind: string }>(
    `INSERT INTO smg.identity_providers (kind, name, issuer)
       VALUES ('proxy_header', 'Seasonal Entertainment website', $1)
     ON CONFLICT (issuer) DO UPDATE SET issuer = EXCLUDED.issuer RETURNING id::text, enabled, kind`,
    [issuer],
  );
  const row = r.rows[0];
  return row?.enabled === true && row.kind === 'proxy_header' ? row.id : null;
}

async function createLinked(c: pg.PoolClient, provider: string, who: WebsiteIdentity) {
  let tries = 0;
  for (const candidate of nameCandidates(who.displayName)) {
    const id = await createLinkedAccount(c, candidate);
    if (id !== null) {
      await c.query(
        'INSERT INTO smg.external_identities (account_id, provider_id, subject) VALUES ($1, $2, $3)',
        [id, provider, who.subject],
      );
      return id;
    }
    if ((tries += 1) > 30) break;
  }
  throw new Error('no free display name');
}

// The wanted name, or the first free one after it (the account's own name counts as free).
async function rename(c: pg.PoolClient, id: string, wanted: string): Promise<void> {
  let tries = 0;
  for (const candidate of nameCandidates(wanted)) {
    const taken = await c.query<{ id: string }>(
      'SELECT id::text FROM smg.accounts WHERE display_name_key = $1',
      [candidate],
    );
    const holder = taken.rows[0]?.id;
    if (holder === undefined || holder === id) {
      await c.query(
        'UPDATE smg.accounts SET display_name = $2, display_name_key = $3 WHERE id = $1',
        [id, candidate, candidate],
      );
      return;
    }
    if ((tries += 1) > 30) break;
  }
  throw new Error('no free display name');
}

// What the website says now: name (when it changed), mapped roles, e-mail verification, steps.
async function follow(c: pg.PoolClient, id: string, who: WebsiteIdentity, before: Linked | null) {
  if (before !== null && before.last_claims.name !== who.websiteName) {
    await rename(c, id, who.displayName);
  }
  await applyRoles(c, id, mappedRoles(who));
  await c.query(
    `UPDATE smg.accounts SET last_login_at = now(), updated_at = now(), steps = $3::jsonb,
       email_verified_at = CASE WHEN $2 THEN COALESCE(email_verified_at, now()) END
     WHERE id = $1`,
    [id, who.emailVerified, JSON.stringify(who.steps)],
  );
  await c.query(
    'UPDATE smg.external_identities SET last_claims = $2::jsonb WHERE account_id = $1',
    [id, JSON.stringify({ name: who.websiteName, roles: who.roles, canHost: who.canHost })],
  );
}

// The account the website member signs in to, or null when refused (the provider is disabled
// or the game account is suspended or deleted).
export async function websiteAccount(
  pool: DbPool,
  issuer: string,
  who: WebsiteIdentity,
): Promise<string | null> {
  return inTransaction(pool, async (c) => {
    const provider = await websiteProvider(c, issuer);
    if (provider === null) return null;
    const found = await c.query<Linked>(
      `SELECT e.account_id::text, a.status, e.last_claims FROM smg.external_identities e
         JOIN smg.accounts a ON a.id = e.account_id
        WHERE e.provider_id = $1 AND e.subject = $2 FOR UPDATE OF e`,
      [provider, who.subject],
    );
    const before = found.rows[0] ?? null;
    if (before !== null && before.status !== 'active') return null;
    const id = before?.account_id ?? (await createLinked(c, provider, who));
    await follow(c, id, who, before);
    return id;
  });
}
