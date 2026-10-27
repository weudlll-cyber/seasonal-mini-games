/**
 * @file   apps/server/test/embed.integration.test.ts
 * @module server/test
 * @brief  The embed allowlist and what it drives, the loader, and the public read API.
 *
 * Responsibility: an admin saves and removes embed origins (audited); the list drives the CSP's
 *                 frame-ancestors (never for the admin app), drops X-Frame-Options, admits the
 *                 socket handshake's Origin and the public API's CORS; the client reads it from
 *                 /public/embed-config; /embed.js loads cross-origin; /auth/handoff hands the
 *                 fragment on to the client; the public routes answer their shapes with display
 *                 names only, cached for 60 s, and a round's result only after its end.
 * Depends on:     vitest, fastify (inject), ./session, ./socketKit
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §3.2–§3.4, §7; docs/spec/09-testing-strategy.md §2
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SUITE_TIMEOUT_MS } from './harness.js';
import { signIn, type Client } from './session.js';
import { startSocketKit, type SocketKit } from './socketKit.js';

const SITE = 'https://site.example';

let kit: SocketKit;
let app: FastifyInstance;
let admin: Client;
const opened: string[] = [];

beforeAll(async () => {
  kit = await startSocketKit();
  app = kit.harness.built.fastify;
  admin = await signIn(app, 'admin');
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  for (const code of opened)
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  await kit.harness.pool.query('DELETE FROM smg.embed_origins');
  await kit.close();
}, SUITE_TIMEOUT_MS);

const get = (url: string, headers: Record<string, string> = {}) =>
  app.inject({ method: 'GET', url, headers });

const ancestors = (csp: unknown) => /frame-ancestors ([^;]*)/.exec(String(csp))?.[1];

describe('the embed allowlist', () => {
  it('is saved and removed by an admin, audited, and published to the client', async () => {
    expect(
      (
        await admin.post('/api/v1/admin/embed-origins', {
          origin: `${SITE}/path`,
          label: 'x',
          allowAuthHandoff: false,
        })
      ).statusCode,
    ).toBe(400);
    const saved = await admin.post('/api/v1/admin/embed-origins', {
      origin: SITE,
      label: 'Test site',
      allowAuthHandoff: true,
    });
    expect(saved.statusCode).toBe(204);
    expect((await admin.get('/api/v1/admin/embed-origins')).json<unknown>()).toMatchObject({
      origins: [{ origin: SITE, label: 'Test site', allowAuthHandoff: true }],
    });
    expect((await get('/api/v1/public/embed-config')).json<unknown>()).toEqual({
      origins: [SITE],
      handoffOrigins: [SITE],
    });
    const log = await admin.get('/api/v1/admin/audit?action=embedOrigin.');
    expect(log.json<{ items: { action: string }[] }>().items[0]?.action).toBe('embedOrigin.save');
  });

  it('drives frame-ancestors and X-Frame-Options, never for the admin app', async () => {
    const page = await get('/');
    expect(ancestors(page.headers['content-security-policy'])).toBe(`'self' ${SITE}`);
    expect(page.headers['x-frame-options']).toBeUndefined();
    const adminApi = await admin.get('/api/v1/admin/embed-origins');
    expect(ancestors(adminApi.headers['content-security-policy'])).toBe("'self'");
    expect(adminApi.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('admits an allowlisted Origin at the socket handshake, and no other', async () => {
    const cookie = kit.clients['player-1'].cookie;
    const allowed = kit.open(cookie, SITE);
    expect(await kit.connected(allowed)).toBe('ok');
    allowed.disconnect();
    expect(await kit.connected(kit.open(cookie, 'https://evil.example'))).toBe(
      'ORIGIN_NOT_ALLOWED',
    );
  });

  it('serves the loader cross-origin and hands the redirect form on to the client', async () => {
    const loader = await get('/embed.js');
    expect(loader.statusCode).toBe(200);
    expect(loader.headers['content-type']).toMatch(/javascript/);
    expect(loader.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(loader.body).toContain('data-smg-embed');
    const landing = await get('/auth/handoff');
    expect(landing.statusCode).toBe(302);
    expect(landing.headers.location).toBe('../?handoff');
  });
});

// A round of a public match won by the host, with player 1 present.
async function endedRound(): Promise<{ code: string; id: string }> {
  const code = await kit.openMatch(['player-1']);
  opened.push(code);
  const sockets = [kit.open(kit.clients.host.cookie), kit.open(kit.clients['player-1'].cookie)];
  for (const s of sockets) {
    expect(await kit.connected(s)).toBe('ok');
    expect((await kit.send(s, 'match.watch', { code })).ok).toBe(true);
  }
  const r = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
    settings: { 'round.cooldownS': 3, 'round.countdownS': 3, 'round.specialOn': false },
    season: 'autumn',
    startNow: true,
  });
  const id = r.json<{ id: string }>().id;
  const early = await get(`/api/v1/public/rounds/${id}/result`);
  expect(early.json<unknown>()).toEqual({ code: 'ROUND_NOT_ENDED' });
  const current = await get(`/api/v1/public/rounds/current?match=${code}`);
  expect(current.json<unknown>()).toMatchObject({
    matchCode: code,
    roundId: id,
    status: 'countdown',
    season: 'autumn',
    halving: false,
    players: 2,
  });
  const opensAt = current.json<{ opensAt: number }>().opensAt;
  await new Promise((done) => setTimeout(done, Math.max(0, opensAt - Date.now()) + 50));
  const secrets = await kit.secretsOf(id);
  const value = secrets.mode === 'shared' ? secrets.value : 0;
  expect(
    await kit.send(sockets[0] ?? kit.open(null), 'guess', { roundId: id, value }),
  ).toMatchObject({ ok: true });
  for (const s of sockets) s.disconnect();
  return { code, id };
}

// The season board with two players and a team, read with a limit of one row.
async function seasonBoard() {
  const pool = kit.harness.pool;
  const period = await pool.query<{ id: string }>(
    `INSERT INTO smg.leaderboard_periods (kind, name, starts_at, ends_at)
     VALUES ('season', 'Autumn test', now() - interval '1 day', now() + interval '30 days') RETURNING id`,
  );
  const id = period.rows[0]?.id;
  for (const [who, points] of [
    ['host', 12],
    ['player-1', 7],
  ] as const) {
    await pool.query(
      `INSERT INTO smg.league_entries (period_id, account_id, points, wins, solves, matches)
       VALUES ($1, $2, $3, 1, 1, 1)`,
      [id, await kit.accountId(who), points],
    );
  }
  await pool.query(
    `INSERT INTO smg.team_league_entries (period_id, team, points, wins) VALUES ($1, 'autumn', 3, 1)`,
    [id],
  );
  const board = await get('/api/v1/public/leaderboards/current?limit=1', { origin: SITE });
  expect(board.headers['cache-control']).toBe('public, max-age=60');
  expect(board.json<unknown>()).toEqual({
    periodName: 'Autumn test',
    rows: [{ rank: 1, displayName: 'dev-host', points: 12, wins: 1, solves: 1, matches: 1 }],
    teams: [{ rank: 1, team: 'autumn', points: 3, wins: 1 }],
  });
  for (const table of ['league_entries', 'team_league_entries', 'leaderboard_periods']) {
    await pool.query(
      `DELETE FROM smg.${table} WHERE ${table === 'leaderboard_periods' ? 'id' : 'period_id'} = $1`,
      [id],
    );
  }
  return board;
}

describe('the public read API', () => {
  it('answers its shapes with display names only, cached for 60 s, with CORS for the allowlist', async () => {
    const { code, id } = await endedRound();
    const hostId = await kit.accountId('host');
    const open = await get('/api/v1/public/matches/open', { origin: SITE });
    expect(open.headers['cache-control']).toBe('public, max-age=60');
    expect(open.headers['access-control-allow-origin']).toBe(SITE);
    expect(open.headers['access-control-allow-credentials']).toBeUndefined();
    expect(open.json<{ matches: unknown[] }>().matches).toContainEqual({
      code,
      title: 'integration',
      players: 2,
      round: { status: 'ended', season: 'autumn' },
    });
    const result = await get(`/api/v1/public/rounds/${id}/result`);
    expect(result.json<unknown>()).toEqual({
      roundId: id,
      matchCode: code,
      endReason: 'solved',
      winner: 'dev-host',
      placings: [{ place: 1, name: 'dev-host', points: expect.any(Number) as number }],
    });
    const board = await seasonBoard();
    for (const r of [open, result, board]) expect(r.body).not.toContain(hostId);
    const elsewhere = await get('/api/v1/public/matches/open', { origin: 'https://evil.example' });
    expect(elsewhere.headers['access-control-allow-origin']).toBeUndefined();
    expect((await get('/api/v1/public/rounds/current?match=nope')).statusCode).toBe(404);
  }, 30_000);

  it('stops admitting an origin once the admin removed it', async () => {
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/embed-origins?origin=${encodeURIComponent(SITE)}`,
      headers: { cookie: admin.cookie, 'x-csrf-token': admin.csrf },
    });
    expect(removed.statusCode).toBe(204);
    expect(ancestors((await get('/')).headers['content-security-policy'])).toBe("'self'");
    expect((await get('/')).headers['x-frame-options']).toBe('SAMEORIGIN');
    const cookie = kit.clients['player-1'].cookie;
    expect(await kit.connected(kit.open(cookie, SITE))).toBe('ORIGIN_NOT_ALLOWED');
  });
});
