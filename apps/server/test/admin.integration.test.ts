/**
 * @file   apps/server/test/admin.integration.test.ts
 * @module server/test
 * @brief  Settings documents, the audit log, account administration, abuse signals, password change.
 *
 * Responsibility: an admin saves a settings change as a new version and the audit log
 *                 records it in an intact hash chain that the database refuses to change;
 *                 a player cannot read admin routes; suspension signs the account out and
 *                 is refused for oneself; nobody grants super_admin to themselves; failed
 *                 logins show as abuse signals; a password change keeps only the current
 *                 session. Accounts made here are removed at the end.
 * Depends on:     vitest, ./harness, ./session, ../src/auth/accounts
 * Spec:           docs/spec/08-admin-settings.md §1; docs/spec/05-security-threat-model.md §1, §2, §8
 */
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { deleteAccount, registerAccount } from '../src/auth/accounts.js';
import { startHarness, stopHarness, SUITE_TIMEOUT_MS, type Harness } from './harness.js';
import { signIn, type Client } from './session.js';

let harness: Harness;
let admin: Client;
let player: Client;
const app = (): FastifyInstance => harness.built.fastify;
const strong = 'correct horse battery staple';

beforeAll(async () => {
  harness = await startHarness();
  admin = await signIn(app(), 'admin');
  player = await signIn(app(), 'player-1');
}, SUITE_TIMEOUT_MS);
afterAll(async () => {
  const made = await harness.pool.query<{ id: string }>(
    "SELECT id FROM smg.accounts WHERE email LIKE '%@example.com'",
  );
  for (const row of made.rows) await deleteAccount(harness.pool, row.id);
  await stopHarness(harness);
}, SUITE_TIMEOUT_MS);

const cookieOf = (r: LightMyRequestResponse): string =>
  `smg_session=${r.cookies.find((c) => c.name === 'smg_session')?.value ?? ''}`;

async function login(email: string): Promise<string> {
  const r = await app().inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password: strong },
  });
  return cookieOf(r);
}

async function account(name: string): Promise<string> {
  const made = await registerAccount(harness.pool, {
    email: `${name}@example.com`,
    displayName: name,
    password: strong,
  });
  if (!made.ok) throw new Error('account exists');
  return made.id;
}

describe('settings documents and the audit log', () => {
  it('saves a new version, audits it in an intact chain and keeps the log append-only', async () => {
    const before = await admin.get('/api/v1/admin/settings/matchmaking');
    expect(before.json<{ version: number }>().version).toBe(1);
    const saved = await admin.put('/api/v1/admin/settings/matchmaking', {
      version: 1,
      comment: 'night test',
      overrides: { 'match.maxPlayers': { value: 300 } },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json<{ values: Record<string, unknown> }>().values['match.maxPlayers']).toBe(300);
    const stale = await admin.put('/api/v1/admin/settings/matchmaking', {
      version: 1,
      overrides: {},
    });
    expect(stale.json()).toMatchObject({ code: 'CONFIG_VERSION_CONFLICT' });
    const bad = await admin.put('/api/v1/admin/settings/matchmaking', {
      version: 2,
      overrides: { 'match.maxPlayers': { value: 5_000 } },
    });
    expect(bad.statusCode).toBe(422);
    const log = await admin.get('/api/v1/admin/audit?action=settings.');
    expect(log.json<{ items: { action: string }[] }>().items[0]?.action).toBe('settings.update');
    expect((await admin.get('/api/v1/admin/audit/verify')).json()).toEqual({ brokenAt: -1 });
    await expect(harness.pool.query('DELETE FROM smg.audit_log')).rejects.toThrow(/append-only/);
    await expect(harness.pool.query("UPDATE smg.audit_log SET action = 'x'")).rejects.toThrow(
      /append-only/,
    );
  });

  it('keeps admin routes from players', async () => {
    for (const url of ['/api/v1/admin/settings', '/api/v1/admin/audit', '/api/v1/admin/accounts']) {
      expect((await player.get(url)).statusCode).toBe(403);
    }
    const anonymous = await app().inject({ method: 'GET', url: '/api/v1/admin/settings' });
    expect(anonymous.statusCode).toBe(401);
  });
});

describe('account administration', () => {
  it('suspends an account (signing it out) and restores it, never oneself', async () => {
    const id = await account('sue');
    const cookie = await login('sue@example.com');
    const suspend = await admin.post(`/api/v1/admin/accounts/${id}/suspend`, {
      reason: 'test run',
    });
    expect(suspend.json()).toEqual({ status: 'suspended' });
    const s = await app().inject({ method: 'GET', url: '/api/v1/session', headers: { cookie } });
    expect(s.json<{ signedIn: boolean }>().signedIn).toBe(false);
    const back = await admin.post(`/api/v1/admin/accounts/${id}/unsuspend`, { reason: 'test run' });
    expect(back.json()).toEqual({ status: 'active' });
    const me = (await admin.get('/api/v1/session')).json<{ account: { id: string } }>().account.id;
    const self = await admin.post(`/api/v1/admin/accounts/${me}/suspend`, { reason: 'test run' });
    expect(self.json()).toEqual({ code: 'NOT_YOURSELF' });
  });

  it('grants and removes roles, but nobody makes themselves super admin', async () => {
    const id = await account('rolf');
    const granted = await admin.post(`/api/v1/admin/accounts/${id}/roles`, {
      role: 'moderator',
      reason: 'helps out',
    });
    expect(granted.json<{ roles: string[] }>().roles).toContain('moderator');
    const removed = await admin.post(`/api/v1/admin/accounts/${id}/roles/remove`, {
      role: 'moderator',
      reason: 'done',
    });
    expect(removed.json<{ roles: string[] }>().roles).not.toContain('moderator');
    const me = (await admin.get('/api/v1/session')).json<{ account: { id: string } }>().account.id;
    const self = await admin.post(`/api/v1/admin/accounts/${me}/roles`, {
      role: 'super_admin',
      reason: 'promote myself',
    });
    expect(self.statusCode).toBe(403);
  });

  it('lists failed logins as abuse signals for moderators', async () => {
    await account('tess');
    await app().inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'tess@example.com', password: 'not the password' },
    });
    const abuse = await admin.get('/api/v1/admin/abuse');
    const rows = abuse.json<{ items: { displayName: string; lastKind: string }[] }>().items;
    expect(rows.find((r) => r.displayName === 'tess')?.lastKind).toBe('loginFailed');
  });
});

describe('password change', () => {
  it('needs the current password and signs out every other session', async () => {
    await account('pia');
    const first = await login('pia@example.com');
    const second = await login('pia@example.com');
    const csrf = (
      await app().inject({ method: 'GET', url: '/api/v1/session', headers: { cookie: first } })
    ).json<{ csrfToken: string }>().csrfToken;
    const change = (current: string) =>
      app().inject({
        method: 'POST',
        url: '/api/v1/me/password',
        payload: { current, next: 'another long passphrase' },
        headers: { cookie: first, 'x-csrf-token': csrf },
      });
    expect((await change('wrong password!')).statusCode).toBe(403);
    expect((await change(strong)).statusCode).toBe(204);
    const other = await app().inject({
      method: 'GET',
      url: '/api/v1/session',
      headers: { cookie: second },
    });
    expect(other.json<{ signedIn: boolean }>().signedIn).toBe(false);
    const kept = await app().inject({
      method: 'GET',
      url: '/api/v1/session',
      headers: { cookie: first },
    });
    expect(kept.json<{ signedIn: boolean }>().signedIn).toBe(true);
  });
});
