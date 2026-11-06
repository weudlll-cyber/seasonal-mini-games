/**
 * @file   apps/server/test/superPromotion.integration.test.ts
 * @module server/test
 * @brief  Website mode: the first super admin is a promoted website account (DECISIONS T243).
 *
 * Responsibility: promotion by website user id ends the member's sessions and survives the role
 *                 mapping recomputed at the next sign-in and a `rights` change; a second run says
 *                 "already"; an unknown id or name, a name two members share and a suspended
 *                 account are refused. The CLI itself (run with tsx): create-super refuses in
 *                 website mode before asking for a password, promote-super --name promotes, and
 *                 promote-super refuses in local mode.
 * Depends on:     vitest, node:child_process, ../src/auth/superPromotion, ./harness, ./websiteHelpers
 * Spec:           docs/spec/07-integration.md §7; Bingo 09 §4, §5
 */
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyAccountChange } from '../src/integration/accountChanges.js';
import { promoteWebsiteSuper } from '../src/auth/superPromotion.js';
import { startHarness, stopHarness, SUITE_TIMEOUT_MS, type Harness } from './harness.js';
import { ORIGIN, sessionOf, signedIn, WEBSITE, type Member } from './websiteHelpers.js';

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness(WEBSITE);
}, SUITE_TIMEOUT_MS);
afterAll(async () => {
  await stopHarness(harness);
}, SUITE_TIMEOUT_MS);

const MAYA: Member = { id: '70', name: 'Maya', canHost: 'true' };
const promote = (target: { websiteId: string } | { name: string }) =>
  promoteWebsiteSuper(harness.pool, ORIGIN, target);
const roleAssign = async (cookie: string | null) =>
  (await sessionOf(harness.built, cookie)).permissions.includes('role.assign');

describe('promote-super (T243)', () => {
  it('promotes by website user id, and the role survives sign-ins and rights changes', async () => {
    const before = await signedIn(harness.built, MAYA);
    expect(await roleAssign(before.cookie)).toBe(false);
    const result = await promote({ websiteId: '70' });
    expect(result).toMatchObject({ kind: 'promoted', member: { websiteId: '70' } });
    expect((await sessionOf(harness.built, before.cookie)).signedIn).toBe(false);
    const again = await signedIn(harness.built, MAYA);
    expect(again.session.kind).toBe('admin');
    expect(await roleAssign(again.cookie)).toBe(true);
    await applyAccountChange(harness.pool, ORIGIN, { id: 70, kind: 'rights' });
    const later = await signedIn(harness.built, { ...MAYA, canHost: 'false' });
    expect(await roleAssign(later.cookie)).toBe(true);
    expect(await promote({ name: 'maya' })).toMatchObject({ kind: 'already' });
  });

  it('refuses an unknown member, a shared name and a suspended account', async () => {
    await signedIn(harness.built, { id: '71', name: 'Twin' });
    await signedIn(harness.built, { id: '72', name: 'Twin' });
    expect(await promote({ websiteId: '999' })).toEqual({ kind: 'unknown' });
    expect(await promote({ name: 'Nobody' })).toEqual({ kind: 'unknown' });
    const shared = await promote({ name: 'twin' });
    expect(shared.kind).toBe('ambiguous');
    const ids = shared.kind === 'ambiguous' ? shared.members.map((m) => m.websiteId) : [];
    expect(ids).toEqual(['71', '72']);
    await harness.pool.query(
      `UPDATE smg.accounts SET status = 'suspended' WHERE id = (SELECT account_id
         FROM smg.external_identities WHERE subject = '72')`,
    );
    expect(await promote({ websiteId: '72' })).toMatchObject({ kind: 'suspended' });
  });
});

// The CLI as `smg admin …` runs it, with tsx instead of the bundle.
function cli(args: readonly string[], env: Record<string, string>) {
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const url = harness.container.getConnectionUri();
  return new Promise<{ code: number; out: string; err: string }>((resolve) => {
    execFile(
      process.execPath,
      ['--import=tsx', 'src/cli.ts', ...args],
      { cwd, env: { ...process.env, DATABASE_URL: url, ...env }, timeout: 30_000 },
      (error, out, err) => {
        resolve({ code: error === null ? 0 : Number(error.code), out, err });
      },
    );
  });
}

describe('the CLI on a website install (T243)', () => {
  it('create-super refuses at once and names promote-super', async () => {
    const r = await cli(['create-super', '--email', 'a@example.org', '--name', 'Admin'], WEBSITE);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/website install.*smg admin promote-super --website-id/s);
    expect(r.out).not.toMatch(/Password/);
  });

  it('promote-super --name promotes; local mode refuses promote-super', async () => {
    await signedIn(harness.built, { id: '73', name: 'Olive' });
    const r = await cli(['promote-super', '--name', 'Olive'], WEBSITE);
    expect(r).toMatchObject({ code: 0 });
    expect(r.out).toMatch(/Olive \(website user id 73\) is now super admin/);
    const local = await cli(['promote-super', '--website-id', '73'], { SMG_AUTH_MODE: 'local' });
    expect(local.code).toBe(1);
    expect(local.err).toMatch(/standalone install uses create-super/);
  });
});
