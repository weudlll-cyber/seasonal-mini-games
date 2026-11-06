/**
 * @file   apps/server/test/websiteSignIn.integration.test.ts
 * @module server/test
 * @brief  Website mode: members sign in only through the website's proxy headers (O66).
 *
 * Responsibility: a server in website mode under /games/mini-games/ (production settings, the
 *                 test runner's address as the trusted proxy): GET <base>auth/website with the
 *                 headers from the trusted peer with the secret creates the account (no
 *                 password, no e-mail), maps the roles (admin → game admin, can-host → host,
 *                 never super_admin or security_admin; `organiser` alone does not host), stores
 *                 the Discord steps and shows them beside the name in the match's players and
 *                 standings and on the boards, starts a rotated game session and redirects to
 *                 `next`; a later sign-in follows a new name and recomputes roles and steps;
 *                 another member with the same name gets a suffix; a suspended account is
 *                 refused. GET /session reports the auth mode and the sign-in route. Matches
 *                 made here are aborted. Adapted from Bingo's websiteLogin and websiteRules tests.
 * Depends on:     vitest, ./harness, ./websiteHelpers
 * Spec:           docs/spec/07-integration.md §7; Bingo 07 §2.1, §2.3
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startHarness, stopHarness, SUITE_TIMEOUT_MS, type Harness } from './harness.js';
import {
  BASE,
  callWith,
  cookieOf,
  headersOf,
  SECRET,
  sessionOf,
  signedIn,
  viaProxy,
  WEBSITE,
} from './websiteHelpers.js';

let harness: Harness;
const app = () => harness.built;

beforeAll(async () => {
  harness = await startHarness(WEBSITE);
}, SUITE_TIMEOUT_MS);
afterAll(async () => {
  await stopHarness(harness);
}, SUITE_TIMEOUT_MS);

const STEPS = [
  { ladder: 'holder' as const, name: 'Acorn', icon: '/media/step-icons/0123.webp' },
  { ladder: 'farmer' as const, name: 'Sprout', icon: null },
];

const accountRow = async (id: string) =>
  (
    await harness.pool.query<{ email: string | null; hash: string | null; steps: unknown[] }>(
      'SELECT email, password_hash AS hash, steps FROM smg.accounts WHERE id = $1',
      [id],
    )
  ).rows[0];

const rolesOf = async (id: string) =>
  (
    await harness.pool.query<{ role_id: string }>(
      'SELECT role_id FROM smg.role_assignments WHERE account_id = $1 ORDER BY role_id',
      [id],
    )
  ).rows.map((r) => r.role_id);

describe('signing in through the website (O66)', () => {
  it('creates the account without password or e-mail and redirects to the page', async () => {
    const r = await viaProxy(
      app(),
      { id: '1', name: 'Walter', canHost: 'true', steps: STEPS },
      { next: `${BASE}#/match/ABC123` },
    );
    expect(r.statusCode).toBe(302);
    expect(r.headers.location).toBe(`${BASE}#/match/ABC123`);
    expect(r.headers['cache-control']).toBe('no-store');
    const s = await sessionOf(app(), cookieOf(r));
    expect(s).toMatchObject({
      signedIn: true,
      authMode: 'website',
      signInPath: `${BASE}auth/website`,
    });
    expect(s.account?.displayName).toBe('Walter');
    expect(s.permissions).toContain('match.create');
    expect(await accountRow(s.account?.id ?? '')).toEqual({
      email: null,
      hash: null,
      steps: STEPS,
    });
  });

  it('follows a new name and recomputes the roles and steps at the next sign-in', async () => {
    const { session } = await signedIn(app(), { id: '1', name: 'Walter W.' });
    expect(session.account?.displayName).toBe('Walter_W.');
    expect(session.permissions).not.toContain('match.create');
    expect(session.permissions).toContain('match.join');
    expect((await accountRow(session.account?.id ?? ''))?.steps).toEqual([]);
  });

  it('gives another member with a taken name a suffix', async () => {
    await signedIn(app(), { id: '2', name: 'Anna' });
    const { session } = await signedIn(app(), { id: '3', name: 'Anna' });
    expect(session.account?.displayName).toBe('Anna-2');
  });

  it('ends the session the browser had before (03 §3)', async () => {
    const member = { id: '4', name: 'Rita' };
    const first = (await signedIn(app(), member)).cookie;
    const again = await viaProxy(app(), member, { headers: { cookie: first ?? '' } });
    expect(again.statusCode).toBe(302);
    expect((await sessionOf(app(), first)).signedIn).toBe(false);
    expect((await sessionOf(app(), cookieOf(again))).signedIn).toBe(true);
  });

  it('refuses a suspended account', async () => {
    const { session } = await signedIn(app(), { id: '5', name: 'Bert' });
    await harness.pool.query(`UPDATE smg.accounts SET status = 'suspended' WHERE id = $1`, [
      session.account?.id,
    ]);
    const refused = await viaProxy(app(), { id: '5', name: 'Bert' });
    expect(refused.statusCode).toBe(403);
    expect(cookieOf(refused)).toBeNull();
  });
});

describe('website roles (O66)', () => {
  it('makes a website admin a game admin until the website drops the role', async () => {
    const admin = await signedIn(app(), { id: '10', name: 'Ada', roles: 'member,admin' });
    const id = admin.session.account?.id ?? '';
    expect(await rolesOf(id)).toEqual(['game_admin', 'player']);
    expect(admin.session.permissions).toContain('match.abort');
    await signedIn(app(), { id: '10', name: 'Ada', roles: 'member' });
    expect(await rolesOf(id)).toEqual(['player']);
  });

  it('lets only can-host host; organiser alone does not', async () => {
    const organiser = await signedIn(app(), { id: '11', name: 'Olga', roles: 'organiser' });
    expect(organiser.session.permissions).not.toContain('match.create');
    const host = await signedIn(app(), { id: '12', name: 'Hugo', canHost: 'true' });
    expect(await rolesOf(host.session.account?.id ?? '')).toEqual(['organizer', 'player']);
  });

  it('never maps any website role to super_admin or security_admin', async () => {
    const all = 'super_admin,security_admin,game_admin,moderator,owner,admin,organiser';
    const greedy = await signedIn(app(), { id: '13', name: 'Greedy', roles: all, canHost: 'true' });
    expect(await rolesOf(greedy.session.account?.id ?? '')).toEqual([
      'game_admin',
      'organizer',
      'player',
    ]);
  });
});

describe('Discord steps beside the name (O66)', () => {
  it("shows a member's steps in the match players and nobody else's", async () => {
    const host = await signedIn(app(), { id: '20', name: 'Stephan', canHost: 'true' });
    const player = await signedIn(app(), { id: '21', name: 'Petra', steps: STEPS });
    const made = await callWith(app(), host, 'matches', {
      gameId: 'guess-the-number',
      title: 'steps',
      maxPlayers: 10,
    });
    const code = made.json<{ code: string }>().code;
    const joined = await callWith(app(), player, `matches/${code}/join`, {});
    expect(joined.statusCode).toBe(204);
    const details = await callWith(app(), player, `matches/${code}`);
    const players = details.json<{ players: { name: string; steps?: unknown }[] }>().players;
    expect(players.find((p) => p.name === 'Petra')?.steps).toEqual(STEPS);
    expect(players.find((p) => p.name === 'Stephan')).not.toHaveProperty('steps');
    await callWith(app(), host, `matches/${code}/abort`, { reason: 'test' });
  });

  it('shows them on the leaderboard rows, an anonymous visitor reading', async () => {
    const r = await harness.pool.query<{ id: string; period: string }>(
      `SELECT a.id::text, p.id::text AS period FROM smg.accounts a, smg.leaderboard_periods p
       WHERE a.display_name = 'Petra' AND p.kind = 'all_time'`,
    );
    const { id, period } = r.rows[0] ?? { id: '', period: '' };
    await harness.pool.query(
      `INSERT INTO smg.league_entries (period_id, account_id, points, wins, solves, matches)
       VALUES ($1, $2, 5, 1, 1, 1)`,
      [period, id],
    );
    const board = await app().fastify.inject({
      method: 'GET',
      url: `${BASE}api/v1/leaderboards/${period}`,
    });
    const rows = board.json<{ rows: { displayName: string; steps?: unknown }[] }>().rows;
    expect(rows.find((row) => row.displayName === 'Petra')?.steps).toEqual(STEPS);
  });
});

describe('the headers count only with the proxy secret', () => {
  it('signs nobody in with a wrong secret', async () => {
    const r = await viaProxy(app(), { id: '30', name: 'Mallory' }, { secret: `${SECRET}0` });
    expect(r.statusCode).toBe(403);
    expect(r.json()).toEqual({ code: 'UNTRUSTED_PROXY' });
    expect(headersOf({ id: '30', name: 'Mallory' })['x-acting-user']).toBe('Mallory');
  });
});
