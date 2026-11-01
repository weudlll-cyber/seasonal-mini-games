/**
 * @file   apps/server/test/adminHistory.integration.test.ts
 * @module server/test
 * @brief  Settings history and rollback against Postgres, and the admin build under /admin/.
 *
 * Responsibility: every save is a version, listed newest first with its changes against the
 *                 one before; a rollback writes a new version with the overrides of the chosen
 *                 one (history stays), is audited as `settings.rollback`, and a stale version
 *                 is 409 CONFIG_VERSION_CONFLICT; the document is back at its defaults at the
 *                 end. With SMG_WEB_DIR and SMG_ADMIN_DIR the server sends /admin on to
 *                 /admin/ and serves the admin build there with the security headers.
 * Depends on:     vitest, node:fs, ./harness, ./session
 * Spec:           docs/spec/08-admin-settings.md §1; docs/spec/06-data-model-api-realtime.md §3.2;
 *                 Bingo 11 §1; Bingo 08 §4
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildOn, startHarness, stopHarness, SUITE_TIMEOUT_MS, type Harness } from './harness.js';
import { signIn, type Client } from './session.js';

let h: Harness;
let admin: Client;
const DOC = '/api/v1/admin/settings/matchmaking';

beforeAll(async () => {
  h = await startHarness();
  admin = await signIn(h.built.fastify, 'admin');
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  await stopHarness(h);
});

const version = async () => (await admin.get(DOC)).json<{ version: number }>().version;

interface VersionRow {
  version: number;
  by: string | null;
  comment: string | null;
  changes: { key: string; before: unknown; after: unknown }[];
}

describe('settings history', () => {
  it('lists versions with their diffs and rolls back as a new version', async () => {
    const v1 = await version();
    const save = (value: number, at: number) =>
      admin.put(DOC, {
        version: at,
        comment: `max ${String(value)}`,
        overrides: { 'match.maxPlayers': { value } },
      });
    expect((await save(300, v1)).statusCode).toBe(200);
    expect((await save(200, v1 + 1)).statusCode).toBe(200);
    const items = (await admin.get(`${DOC}/versions`)).json<{ items: VersionRow[] }>().items;
    expect(items.map((v) => v.version)).toEqual([v1 + 2, v1 + 1]);
    expect(items[0]).toMatchObject({
      by: 'dev-admin',
      comment: 'max 200',
      changes: [{ key: 'match.maxPlayers', before: { value: 300 }, after: { value: 200 } }],
    });
    expect(items[1]?.changes).toEqual([
      { key: 'match.maxPlayers', before: null, after: { value: 300 } },
    ]);

    const rollback = (at: number, to: number) =>
      admin.post(`${DOC}/rollback`, { version: at, toVersion: to, comment: 'undo the 200' });
    expect((await rollback(v1 + 1, v1 + 1)).json()).toMatchObject({
      code: 'CONFIG_VERSION_CONFLICT',
    });
    expect((await rollback(v1 + 2, 99)).statusCode).toBe(404);
    const back = await rollback(v1 + 2, v1 + 1);
    expect(back.json()).toMatchObject({ version: v1 + 3, values: { 'match.maxPlayers': 300 } });
    const after = (await admin.get(`${DOC}/versions`)).json<{ items: VersionRow[] }>().items;
    expect(after.map((v) => v.version)).toEqual([v1 + 3, v1 + 2, v1 + 1]);
    expect(after[0]?.comment).toBe(`Rollback to version ${String(v1 + 1)}: undo the 200`);
    const audit = (await admin.get('/api/v1/admin/audit?action=settings.rollback')).json<{
      items: { targetId: string }[];
    }>().items;
    expect(audit[0]?.targetId).toBe('matchmaking');

    // Back to the defaults (version 1 holds none), still as a new version.
    const reset = await rollback(v1 + 3, 1);
    expect(reset.json()).toMatchObject({ version: v1 + 4, overrides: {} });
  });

  it('refuses the history without admin.view and for an unknown document', async () => {
    const player = await signIn(h.built.fastify, 'player-1');
    expect((await player.get(`${DOC}/versions`)).statusCode).toBe(403);
    expect((await admin.get('/api/v1/admin/settings/nope/versions')).statusCode).toBe(404);
  });
});

describe('the admin build', () => {
  it('is served under /admin/ from SMG_ADMIN_DIR with the security headers', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'smg-admin-'));
    const web = path.join(dir, 'web');
    const adminDir = path.join(dir, 'admin');
    mkdirSync(path.join(adminDir, 'assets'), { recursive: true });
    mkdirSync(web);
    writeFileSync(path.join(web, 'index.html'), '<!doctype html><title>player</title>');
    writeFileSync(path.join(adminDir, 'index.html'), '<!doctype html><title>admin</title>');
    writeFileSync(path.join(adminDir, 'assets', 'app-1a2b.js'), 'export {};');
    const app = await buildOn(h.pool, h.container.getConnectionUri(), {
      SMG_WEB_DIR: web,
      SMG_ADMIN_DIR: adminDir,
    });
    try {
      const get = (url: string) => app.fastify.inject({ method: 'GET', url });
      const moved = await get('/admin');
      expect(moved.statusCode).toBe(302);
      expect(moved.headers.location).toBe('admin/');
      const page = await get('/admin/');
      expect(page.body).toContain('<title>admin</title>');
      expect(page.headers['content-security-policy']).toContain("default-src 'self'");
      expect(page.headers['x-content-type-options']).toBe('nosniff');
      const asset = await get('/admin/assets/app-1a2b.js');
      expect(asset.headers['cache-control']).toContain('immutable');
      expect((await get('/admin/../web/index.html')).statusCode).toBe(404);
      expect((await get('/')).body).toContain('<title>player</title>');
    } finally {
      await app.fastify.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
