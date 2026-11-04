/**
 * @file   apps/server/test/providers.integration.test.ts
 * @module server/test
 * @brief  A change of an identity provider without its pinned key keeps the key in force.
 *
 * Responsibility: the admin app never sees a pinned key again, so a PUT without
 *                 `pinnedPublicKey` (an edit, a disable) keeps it, audited as "kept"; a PUT that
 *                 leaves a JWKS provider with neither a key nor an address is refused with 400;
 *                 `pinnedPublicKey: null` still removes the key where a JWKS address remains.
 *                 The providers made here are removed at the end.
 * Depends on:     vitest, node:crypto, ./harness, ./session
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §2.1; DECISIONS T175
 */
import { generateKeyPairSync } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startHarness, stopHarness, SUITE_TIMEOUT_MS, type Harness } from './harness.js';
import { signIn, type Client } from './session.js';

const PEM = generateKeyPairSync('ed25519')
  .publicKey.export({ type: 'spki', format: 'pem' })
  .toString();
const URL_BASE = '/api/v1/admin/identity-providers';

let harness: Harness;
let admin: Client;

beforeAll(async () => {
  harness = await startHarness();
  admin = await signIn(harness.built.fastify, 'admin');
}, SUITE_TIMEOUT_MS);
afterAll(async () => {
  await harness.pool.query("DELETE FROM smg.identity_providers WHERE issuer LIKE '%.keep.test'");
  await stopHarness(harness);
}, SUITE_TIMEOUT_MS);

const body = (issuer: string, over: Record<string, unknown> = {}) => ({
  name: issuer,
  issuer: `https://${issuer}.keep.test`,
  allowedAlgs: ['EdDSA'],
  jwksUrl: null,
  pinnedPublicKey: PEM,
  roleMapping: {},
  enabled: true,
  ...over,
});

const keyOf = async (id: string) =>
  (
    await harness.pool.query<{ k: string | null }>(
      'SELECT pinned_public_key AS k FROM smg.identity_providers WHERE id = $1',
      [id],
    )
  ).rows[0]?.k;

describe('a change of an identity provider', () => {
  it('keeps the pinned key when the body leaves it out, and audits it as kept', async () => {
    const id = (await admin.post(URL_BASE, body('pinned'))).json<{ id: string }>().id;
    const { pinnedPublicKey: _left, ...keep } = body('pinned', { enabled: false });
    const changed = await admin.put(`${URL_BASE}/${id}`, keep);
    expect(changed.statusCode).toBe(200);
    expect(changed.json<unknown>()).toMatchObject({ enabled: false, hasPinnedKey: true });
    expect(await keyOf(id)).toBe(PEM);
    const audit = await harness.pool.query<{ diff: { pinnedPublicKey: string } }>(
      "SELECT diff FROM smg.audit_log WHERE action = 'identityProvider.update' AND target_id = $1",
      [id],
    );
    expect(audit.rows[0]?.diff.pinnedPublicKey).toBe('kept');
  });

  it('refuses to leave a provider without a key source; null still removes the key', async () => {
    const jwks = { jwksUrl: 'https://jwks.keep.test/keys.json', pinnedPublicKey: null };
    const id = (await admin.post(URL_BASE, body('jwks', jwks))).json<{ id: string }>().id;
    const { pinnedPublicKey: _none, ...noKey } = body('jwks');
    const refused = await admin.put(`${URL_BASE}/${id}`, noKey);
    expect(refused.statusCode).toBe(400);
    expect(refused.json<unknown>()).toMatchObject({ code: 'VALIDATION_FAILED' });
    const both = await admin.put(`${URL_BASE}/${id}`, body('jwks', { jwksUrl: jwks.jwksUrl }));
    expect(both.json<unknown>()).toMatchObject({ hasPinnedKey: true });
    const removed = await admin.put(`${URL_BASE}/${id}`, body('jwks', jwks));
    expect(removed.json<unknown>()).toMatchObject({ hasPinnedKey: false });
  });
});
