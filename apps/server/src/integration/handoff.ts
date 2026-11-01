/**
 * @file   apps/server/src/integration/handoff.ts
 * @module server/integration
 * @brief  Redeems a host's handoff token: verify, spend its `jti`, link or create the account.
 *
 * Responsibility: the token's issuer picks an enabled provider, whose key and rules verify it
 *                 (./jwt); its `jti` is spent once (smg.jwt_replay_cache); the account is found by
 *                 (provider, sub) only, never by e-mail, or created on first login with a valid,
 *                 unique display name from `name`; `last_claims` keeps `name` and `links` (07 §4)
 *                 and mapped roles are recomputed, never security_admin or super_admin (Bingo 07 §2.1).
 * Depends on:     pg, ../db/pool, ../auth/accounts, ./jwt, ./keys, ./providers
 * Used by:        ../http/routes/handoff
 * Spec:           docs/spec/07-integration.md §1, §4; Bingo 07 §2.1, §2.2; Bingo 03 §4
 */
import { randomBytes } from 'node:crypto';

import type pg from 'pg';

import { createLinkedAccount } from '../auth/accounts.js';
import { inTransaction, type DbPool } from '../db/pool.js';
import { HandoffRefused, issuerOf, verifyHandoff, type HandoffClaims } from './jwt.js';
import type { ProviderKeys } from './keys.js';
import { enabledProvider, MAPPABLE_ROLES, type Provider } from './providers.js';

// The replay cache keeps a `jti` past the token's end by the clock skew the verifier allows.
const REPLAY_MARGIN_S = 30;

interface HandoffDeps {
  readonly pool: DbPool;
  readonly keys: ProviderKeys;
}

// The platform roles a host's roles map to: only player, organizer and moderator, whatever the
// stored mapping says (Bingo 07 §2.1).
export function mappedRoles(
  mapping: Readonly<Record<string, string>>,
  hostRoles: readonly string[],
): string[] {
  const roles = hostRoles
    .filter((r) => Object.hasOwn(mapping, r))
    .map((r) => mapping[r] ?? '')
    .filter((r) => MAPPABLE_ROLES.has(r));
  return [...new Set(roles)];
}

// Display names to try for a new account: the `name` claim made valid (3–24 letters, digits,
// `_.-`), then with -2, -3, …, then with a random suffix.
export function* nameCandidates(name: string | null): Generator<string> {
  const cleaned = (name ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_.-]/gu, '')
    .slice(0, 24);
  const base = cleaned.length >= 3 ? cleaned : 'player';
  yield base;
  for (let n = 2; n <= 20; n += 1) yield `${base.slice(0, 24 - String(n).length - 1)}-${String(n)}`;
  for (;;) yield `${base.slice(0, 17)}-${randomBytes(3).toString('hex')}`;
}

async function spend(c: pg.PoolClient, issuer: string, claims: HandoffClaims): Promise<void> {
  const r = await c.query(
    `INSERT INTO smg.jwt_replay_cache (issuer, jti, expires_at)
     VALUES ($1, $2, to_timestamp($3)) ON CONFLICT DO NOTHING`,
    [issuer, claims.jti, claims.exp + REPLAY_MARGIN_S],
  );
  if (r.rowCount === 0) throw new HandoffRefused('token already used');
}

async function newAccount(c: pg.PoolClient, name: string | null): Promise<string> {
  let tries = 0;
  for (const candidate of nameCandidates(name)) {
    const id = await createLinkedAccount(c, candidate);
    if (id !== null) return id;
    if ((tries += 1) > 30) break;
  }
  throw new HandoffRefused('no free display name');
}

// The linked account (created on first login) with the claims of this login stored.
async function linkedAccount(
  c: pg.PoolClient,
  provider: Provider,
  claims: HandoffClaims,
): Promise<string> {
  const lastClaims = JSON.stringify({ name: claims.name, links: claims.links });
  const found = await c.query<{ account_id: string; status: string }>(
    `SELECT ei.account_id::text, a.status FROM smg.external_identities ei
     JOIN smg.accounts a ON a.id = ei.account_id
     WHERE ei.provider_id = $1 AND ei.subject = $2 FOR UPDATE OF ei`,
    [provider.id, claims.sub],
  );
  const row = found.rows[0];
  if (row !== undefined) {
    if (row.status !== 'active') throw new HandoffRefused('account not active');
    await c.query(
      'UPDATE smg.external_identities SET last_claims = $3 WHERE provider_id = $1 AND subject = $2',
      [provider.id, claims.sub, lastClaims],
    );
    return row.account_id;
  }
  const accountId = await newAccount(c, claims.name);
  await c.query(
    `INSERT INTO smg.external_identities (account_id, provider_id, subject, last_claims)
     VALUES ($1, $2, $3, $4)`,
    [accountId, provider.id, claims.sub, lastClaims],
  );
  return accountId;
}

// Mapped roles are recomputed at every login; roles given by hand stay (Bingo 07 §2.1).
async function applyRoles(c: pg.PoolClient, accountId: string, roles: readonly string[]) {
  await c.query(
    "DELETE FROM smg.role_assignments WHERE account_id = $1 AND source = 'idp_mapping'",
    [accountId],
  );
  await c.query(
    `INSERT INTO smg.role_assignments (account_id, role_id, source)
     SELECT $1, unnest($2::text[]), 'idp_mapping' ON CONFLICT DO NOTHING`,
    [accountId, roles],
  );
}

// The account the token signs in; throws HandoffRefused for any token that does not hold.
export async function redeemHandoff(deps: HandoffDeps, token: string): Promise<string> {
  const issuer = issuerOf(token);
  const provider = issuer === null ? null : await enabledProvider(deps.pool, issuer);
  if (issuer === null || provider === null) throw new HandoffRefused('unknown issuer');
  const claims = await verifyHandoff(token, {
    issuer,
    audience: provider.audience,
    allowedAlgs: provider.allowedAlgs,
    now: Math.floor(Date.now() / 1000),
    keyFor: (kid, alg) => deps.keys.keyFor(provider, kid, alg),
  });
  return inTransaction(deps.pool, async (c) => {
    await spend(c, issuer, claims);
    const accountId = await linkedAccount(c, provider, claims);
    await applyRoles(c, accountId, mappedRoles(provider.roleMapping, claims.roles));
    return accountId;
  });
}

// The retention job: spent `jti`s whose tokens have expired.
export async function purgeReplayCache(pool: DbPool): Promise<number> {
  const r = await pool.query('DELETE FROM smg.jwt_replay_cache WHERE expires_at < now()');
  return r.rowCount ?? 0;
}
