/**
 * @file   apps/server/src/http/plugins/maintenance.test.ts
 * @module server/http
 * @brief  Maintenance refuses only what starts something new, and follows the flag file.
 *
 * Responsibility: with the flag on, opening a match, creating a round and the Quick Test
 *                 answer 503 MAINTENANCE while other requests (a guess, a read) go through; the
 *                 flag file is looked up at most once per interval and seen as soon as it is due.
 * Depends on:     vitest, fastify, node:fs, node:os, ./maintenance
 * Spec:           docs/spec/10-repository-structure.md §6
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import Fastify from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';

import { maintenanceFlag, registerMaintenance } from './maintenance.js';

const dir = mkdtempSync(path.join(tmpdir(), 'smg-maintenance-'));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function app(on: () => boolean) {
  const f = Fastify();
  registerMaintenance(f, on);
  const ok = () => ({ ok: true });
  f.post('/api/v1/matches', ok);
  f.post('/api/v1/matches/:code/rounds', ok);
  f.post('/api/v1/dev/quicktest', ok);
  f.post('/api/v1/rounds/:id/guesses', ok);
  f.get('/api/v1/matches', ok);
  await f.ready();
  return f;
}

describe('maintenance', () => {
  it('refuses new matches, new rounds and the Quick Test, and nothing else', async () => {
    const f = await app(() => true);
    for (const url of [
      '/api/v1/matches',
      '/api/v1/matches/ABC234/rounds',
      '/api/v1/dev/quicktest',
    ]) {
      const r = await f.inject({ method: 'POST', url });
      expect([url, r.statusCode, r.json<{ code: string }>().code]).toEqual([
        url,
        503,
        'MAINTENANCE',
      ]);
    }
    expect((await f.inject({ method: 'POST', url: '/api/v1/rounds/r1/guesses' })).statusCode).toBe(
      200,
    );
    expect((await f.inject({ method: 'GET', url: '/api/v1/matches' })).statusCode).toBe(200);
    await f.close();
    const off = await app(() => false);
    expect((await off.inject({ method: 'POST', url: '/api/v1/matches' })).statusCode).toBe(200);
    await off.close();
  });

  it('reads the flag file at most once per interval', () => {
    let now = 0;
    const flag = maintenanceFlag(dir, 1_000, () => now);
    expect(flag()).toBe(false);
    writeFileSync(path.join(dir, 'maintenance'), '');
    now = 999;
    expect(flag()).toBe(false);
    now = 1_000;
    expect(flag()).toBe(true);
    rmSync(path.join(dir, 'maintenance'));
    now = 2_000;
    expect(flag()).toBe(false);
  });
});
