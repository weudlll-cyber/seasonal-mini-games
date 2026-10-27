/**
 * @file   apps/server/test/handoff.integration.test.ts
 * @module server/test
 * @brief  The JWT handoff end to end: providers through the admin API, sign-in, linking, the
 *         `links` claim, replay, roles, CORS, and the linked-chat roster rule.
 *
 * Responsibility: an admin registers a host's provider (a private key or an admin role in the
 *                 mapping refused; audited without the key); a host token signs a new account in
 *                 with a first-party cookie, links it by (provider, sub) only, never by e-mail,
 *                 stores `links` and refreshes it at the next login; a spent `jti`, another
 *                 audience, a disabled provider are refused; mapped roles apply; the handoff
 *                 answers CORS only for allowlisted handoff origins; with
 *                 `antiMulti.requireLinkedChat` a shared round keeps only linked players.
 * Depends on:     vitest, node:crypto, ../src/auth/accounts, ./session, ./socketKit
 * Spec:           docs/spec/07-integration.md §1, §4; docs/spec/05-security-threat-model.md §6;
 *                 Bingo 07 §2.1, §2.2, §3.4; docs/spec/09-testing-strategy.md §2
 */
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { deleteAccount } from '../src/auth/accounts.js';
import { SUITE_TIMEOUT_MS } from './harness.js';
import { signIn, type Client } from './session.js';
import { startSocketKit, type SocketKit } from './socketKit.js';

const ISS = 'https://host.example';
const keys = generateKeyPairSync('ed25519');
const PUBLIC_PEM = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();

let kit: SocketKit;
let app: FastifyInstance;
let admin: Client;
let providerId = '';

beforeAll(async () => {
  kit = await startSocketKit();
  app = kit.harness.built.fastify;
  admin = await signIn(app, 'admin');
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  // The accounts the handoffs made, then the provider (its links go with it).
  const made = await kit.harness.pool.query<{ account_id: string }>(
    'SELECT account_id::text FROM smg.external_identities',
  );
  for (const row of made.rows) await deleteAccount(kit.harness.pool, row.account_id);
  await kit.harness.pool.query('DELETE FROM smg.identity_providers WHERE id = $1', [providerId]);
  await kit.harness.pool.query(
    "DELETE FROM smg.embed_origins WHERE origin LIKE 'https://%.example'",
  );
  await kit.close();
}, SUITE_TIMEOUT_MS);

function token(claims: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000);
  const part = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const head = part({ alg: 'EdDSA', typ: 'JWT' });
  const body = part({
    iss: ISS,
    aud: 'seasonal-mini-games',
    sub: 'user-1',
    jti: randomUUID(),
    iat: now,
    exp: now + 60,
    ...claims,
  });
  const sig = sign(null, Buffer.from(`${head}.${body}`), keys.privateKey).toString('base64url');
  return `${head}.${body}.${sig}`;
}

async function handoff(t: string, origin?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/handoff',
    payload: { token: t },
    headers: origin === undefined ? {} : { origin },
  });
}

// The signed-in client of a handoff answer.
async function clientOf(answer: Awaited<ReturnType<typeof handoff>>) {
  const cookie = `smg_session=${answer.cookies.find((c) => c.name === 'smg_session')?.value ?? ''}`;
  const s = await app.inject({ method: 'GET', url: '/api/v1/session', headers: { cookie } });
  return {
    cookie,
    session: s.json<{
      signedIn: boolean;
      account: { id: string; displayName: string };
      permissions: string[];
    }>(),
  };
}

const lastClaims = async (accountId: string) =>
  (
    await kit.harness.pool.query<{ last_claims: unknown }>(
      'SELECT last_claims FROM smg.external_identities WHERE account_id = $1',
      [accountId],
    )
  ).rows[0]?.last_claims;

const providerBody = (over: Record<string, unknown> = {}) => ({
  name: 'Seasonal Entertainment (test)',
  issuer: ISS,
  allowedAlgs: ['EdDSA'],
  jwksUrl: null,
  pinnedPublicKey: PUBLIC_PEM,
  roleMapping: { organizers: 'organizer' },
  enabled: true,
  ...over,
});

describe('identity providers', () => {
  it('are registered through the admin API, audited without the key', async () => {
    const privatePem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const withPrivate = await admin.post(
      '/api/v1/admin/identity-providers',
      providerBody({ pinnedPublicKey: privatePem }),
    );
    expect(withPrivate.statusCode).toBe(400);
    const adminRole = await admin.post(
      '/api/v1/admin/identity-providers',
      providerBody({ roleMapping: { staff: 'super_admin' } }),
    );
    expect(adminRole.statusCode).toBe(400);
    const made = await admin.post('/api/v1/admin/identity-providers', providerBody());
    expect(made.statusCode).toBe(201);
    providerId = made.json<{ id: string }>().id;
    expect(made.json<unknown>()).toMatchObject({
      hasPinnedKey: true,
      audience: 'seasonal-mini-games',
    });
    expect(made.body).not.toContain('BEGIN PUBLIC KEY');
    const audit = await kit.harness.pool.query<{ diff: unknown }>(
      "SELECT diff FROM smg.audit_log WHERE action = 'identityProvider.create'",
    );
    expect(JSON.stringify(audit.rows)).not.toContain('BEGIN PUBLIC KEY');
    const again = await admin.post('/api/v1/admin/identity-providers', providerBody());
    expect(again.json<unknown>()).toMatchObject({ code: 'ISSUER_TAKEN' });
  });
});

describe('the handoff', () => {
  it('signs a new account in, links it by (provider, sub) and refreshes `links`', async () => {
    const hostEmail = 'dev-host@dev.invalid';
    const first = await handoff(token({ name: 'Walter', email: hostEmail, links: ['telegram'] }));
    expect(first.statusCode).toBe(200);
    const one = await clientOf(first);
    expect(one.session).toMatchObject({ signedIn: true, account: { displayName: 'Walter' } });
    // Never linked by e-mail: the dev host keeps its own account.
    expect(one.session.account.id).not.toBe(await kit.accountId('host'));
    expect(one.session.permissions).not.toContain('match.create');
    expect(await lastClaims(one.session.account.id)).toEqual({
      name: 'Walter',
      links: ['telegram'],
    });
    const second = await clientOf(await handoff(token({ name: 'W.', roles: ['organizers'] })));
    expect(second.session.account.id).toBe(one.session.account.id);
    expect(second.session.permissions).toContain('match.create');
    expect(await lastClaims(one.session.account.id)).toEqual({ name: 'W.', links: [] });
    // Another person of the same name gets a name of their own.
    const other = await clientOf(await handoff(token({ sub: 'user-2', name: 'Walter' })));
    expect(other.session.account.displayName).toBe('Walter-2');
  });

  it('refuses a spent jti, another audience, an unknown issuer and a disabled provider', async () => {
    const t = token({ sub: 'user-3' });
    expect((await handoff(t)).statusCode).toBe(200);
    expect((await handoff(t)).json<unknown>()).toEqual({ code: 'HANDOFF_REFUSED' });
    expect((await handoff(token({ aud: 'seasonal-bingo-royale' }))).statusCode).toBe(401);
    expect((await handoff(token({ iss: 'https://other.example' }))).statusCode).toBe(401);
    await admin.put(
      `/api/v1/admin/identity-providers/${providerId}`,
      providerBody({ enabled: false }),
    );
    expect((await handoff(token({ sub: 'user-3' }))).statusCode).toBe(401);
    await admin.put(`/api/v1/admin/identity-providers/${providerId}`, providerBody());
  });
});

describe('the handoff from a host page', () => {
  it('answers CORS only for allowlisted origins that may hand off a sign-in', async () => {
    for (const [origin, allowAuthHandoff] of [
      ['https://host.example', true],
      ['https://widgets.example', false],
    ] as const) {
      const saved = await admin.post('/api/v1/admin/embed-origins', {
        origin,
        label: origin,
        allowAuthHandoff,
      });
      expect(saved.statusCode).toBe(204);
    }
    const ok = await handoff(token({ sub: 'user-4' }), 'https://host.example');
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['access-control-allow-origin']).toBe('https://host.example');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    for (const origin of ['https://widgets.example', 'https://evil.example']) {
      const refused = await handoff(token({ sub: 'user-5' }), origin);
      expect(refused.json<unknown>()).toEqual({ code: 'ORIGIN_NOT_ALLOWED' });
      expect(refused.headers['access-control-allow-origin']).toBeUndefined();
    }
    const preflight = (origin: string) =>
      app.inject({ method: 'OPTIONS', url: '/api/v1/auth/handoff', headers: { origin } });
    expect((await preflight('https://host.example')).statusCode).toBe(204);
    expect((await preflight('https://evil.example')).statusCode).toBe(403);
  });
});

describe('the linked-chat roster rule (05 §6)', () => {
  it('keeps only players whose website account is linked to Telegram or Discord', async () => {
    const rule = await admin.get('/api/v1/admin/settings/security');
    await admin.put('/api/v1/admin/settings/security', {
      version: rule.json<{ version: number }>().version,
      overrides: { 'antiMulti.requireLinkedChat': { value: true } },
    });
    const people = [
      await clientOf(
        await handoff(token({ sub: 'linked-1', name: 'Linked1', links: ['discord'] })),
      ),
      await clientOf(
        await handoff(token({ sub: 'linked-2', name: 'Linked2', links: ['telegram'] })),
      ),
      await clientOf(await handoff(token({ sub: 'unlinked', name: 'Unlinked' }))),
    ];
    const code = await kit.openMatch([]);
    for (const p of people) {
      const csrf = (
        await app.inject({ method: 'GET', url: '/api/v1/session', headers: { cookie: p.cookie } })
      ).json<{ csrfToken: string }>().csrfToken;
      const headers = { cookie: p.cookie, 'x-csrf-token': csrf };
      await app.inject({
        method: 'POST',
        url: `/api/v1/matches/${code}/join`,
        payload: {},
        headers,
      });
      const s = kit.open(p.cookie);
      expect(await kit.connected(s)).toBe('ok');
      expect((await kit.send(s, 'match.watch', { code })).ok).toBe(true);
    }
    const created = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
      settings: { 'round.countdownS': 3, 'round.specialOn': false },
      season: 'spring',
      startNow: true,
    });
    const id = created.json<{ id: string }>().id;
    const state = await kit.clients.host.get(`/api/v1/rounds/${id}/state`);
    const roster = state.json<{ roster: { playerKey: string }[] }>().roster.map((r) => r.playerKey);
    expect(roster.sort()).toEqual(
      [people[0]?.session.account.id, people[1]?.session.account.id].sort(),
    );
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  });
});
