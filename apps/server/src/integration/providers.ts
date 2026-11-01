/**
 * @file   apps/server/src/integration/providers.ts
 * @module server/integration
 * @brief  Identity providers of the JWT handoff in PostgreSQL: list, find, save, remove.
 *
 * Responsibility: the rows of smg.identity_providers (kind `jwt_handoff`) as the admin's view
 *                 (whether a key is pinned, never the key itself) and as the handoff's policy
 *                 (issuer, audience `seasonal-mini-games`, algorithms, key source, role mapping);
 *                 a mapping to security_admin or super_admin is refused on save and ignored on use.
 * Depends on:     @smg/contracts (views, body), ../db/pool, ./keys (types)
 * Used by:        ./handoff, ../http/routes/adminIntegration
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §2.1, §2.2; Bingo 04 §3.1
 */
import type { IdentityProviderBody, IdentityProviderView } from '@smg/contracts';
import type { z } from 'zod';

import type { DbPool } from '../db/pool.js';
import type { KeySource } from './keys.js';

// The roles a mapping may grant; never security_admin or super_admin (Bingo 07 §2.1).
export const MAPPABLE_ROLES: ReadonlySet<string> = new Set(['player', 'organizer', 'moderator']);

export interface Provider extends KeySource {
  readonly issuer: string;
  readonly audience: string;
  readonly allowedAlgs: readonly string[];
  readonly roleMapping: Readonly<Record<string, string>>;
}

interface Row {
  id: string;
  name: string;
  issuer: string;
  audience: string;
  allowed_algs: string[];
  jwks_url: string | null;
  pinned_public_key: string | null;
  role_mapping: Record<string, string>;
  enabled: boolean;
  updated_at: Date;
}

const COLUMNS = `id::text, name, issuer, audience, allowed_algs, jwks_url, pinned_public_key,
  role_mapping, enabled, updated_at`;

const view = (r: Row): IdentityProviderView => ({
  id: r.id,
  name: r.name,
  issuer: r.issuer,
  audience: r.audience,
  allowedAlgs: r.allowed_algs,
  jwksUrl: r.jwks_url,
  hasPinnedKey: r.pinned_public_key !== null,
  roleMapping: r.role_mapping,
  enabled: r.enabled,
});

export async function listProviders(pool: DbPool): Promise<IdentityProviderView[]> {
  const r = await pool.query<Row>(`SELECT ${COLUMNS} FROM smg.identity_providers ORDER BY name`);
  return r.rows.map(view);
}

// The enabled provider of an issuer, for the handoff.
export async function enabledProvider(pool: DbPool, issuer: string): Promise<Provider | null> {
  const r = await pool.query<Row>(
    `SELECT ${COLUMNS} FROM smg.identity_providers
     WHERE issuer = $1 AND enabled AND kind = 'jwt_handoff'`,
    [issuer],
  );
  const row = r.rows[0];
  if (row === undefined) return null;
  return {
    id: row.id,
    version: row.updated_at.getTime(),
    issuer: row.issuer,
    audience: row.audience,
    allowedAlgs: row.allowed_algs,
    jwksUrl: row.jwks_url,
    pinnedPublicKey: row.pinned_public_key,
    roleMapping: row.role_mapping,
  };
}

type Body = z.infer<typeof IdentityProviderBody>;

const values = (b: Body) => [
  b.name,
  b.issuer,
  b.allowedAlgs,
  b.jwksUrl,
  b.pinnedPublicKey,
  JSON.stringify(b.roleMapping),
  b.enabled,
];

// A new provider; null when its issuer is taken.
export async function createProvider(pool: DbPool, b: Body): Promise<IdentityProviderView | null> {
  const r = await pool.query<Row>(
    `INSERT INTO smg.identity_providers
       (kind, name, issuer, allowed_algs, jwks_url, pinned_public_key, role_mapping, enabled)
     VALUES ('jwt_handoff', $1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (issuer) DO NOTHING RETURNING ${COLUMNS}`,
    values(b),
  );
  return r.rows[0] === undefined ? null : view(r.rows[0]);
}

// The provider changed; null when it does not exist (or the new issuer is another's).
export async function updateProvider(
  pool: DbPool,
  id: string,
  b: Body,
): Promise<IdentityProviderView | null> {
  try {
    const r = await pool.query<Row>(
      `UPDATE smg.identity_providers SET name = $2, issuer = $3, allowed_algs = $4, jwks_url = $5,
         pinned_public_key = $6, role_mapping = $7, enabled = $8, updated_at = now()
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, ...values(b)],
    );
    return r.rows[0] === undefined ? null : view(r.rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return null;
    throw error;
  }
}

// Removing a provider removes its links (cascade); the accounts stay.
export async function deleteProvider(pool: DbPool, id: string): Promise<boolean> {
  const r = await pool.query('DELETE FROM smg.identity_providers WHERE id = $1', [id]);
  return (r.rowCount ?? 0) > 0;
}
