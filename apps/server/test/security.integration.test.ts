/**
 * @file   apps/server/test/security.integration.test.ts
 * @module server/test
 * @brief  The security fixes adopted from Bingo's audit, against a listening server.
 *
 * Responsibility: per-address limits for guest sessions and requests without a session; dead
 *                 sessions purged; a socket closes when its session ends (logout, account
 *                 deletion); the socket handshake checks the Origin; the cookie is `__Secure-`
 *                 with the base path under a path and cleared with Secure; admin accounts get
 *                 short sessions; the Permissions-Policy header; /metrics refused through a
 *                 proxy; no e-mail to anonymous viewers of a match, a round's result and proof,
 *                 the boards and a profile, and no account id on the boards and profiles; a
 *                 broken %-escape answers 400. Matches are aborted and the accounts made here
 *                 removed at the end. Adapted from Bingo's security.integration.test.ts.
 * Depends on:     vitest, node:fs, fastify, socket.io-client (types), ../src/auth/*, ./harness,
 *                 ./session, ./socketKit
 * Spec:           docs/spec/05-security-threat-model.md §1 (Bingo 03 §3, §7, §8, §13);
 *                 docs/spec/09-testing-strategy.md §6
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { InjectOptions } from 'fastify';
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { deleteAccount, registerAccount } from '../src/auth/accounts.js';
import { purgeDeadSessions } from '../src/auth/sessions.js';
import { buildOn, SUITE_TIMEOUT_MS } from './harness.js';
import { signIn } from './session.js';
import { startSocketKit, type SocketKit } from './socketKit.js';

let kit: SocketKit;
const opened: string[] = [];

beforeAll(async () => {
  kit = await startSocketKit();
}, SUITE_TIMEOUT_MS);
afterAll(async () => {
  for (const code of opened)
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  const made = await kit.harness.pool.query<{ id: string }>(
    "SELECT id FROM smg.accounts WHERE email LIKE 'sec-%@example.com'",
  );
  for (const row of made.rows) await deleteAccount(kit.harness.pool, row.id);
  await kit.close();
}, SUITE_TIMEOUT_MS);

const PASSWORD = 'correct horse battery staple';
const inject = (o: InjectOptions) => kit.harness.built.fastify.inject(o);
const cookieOf = (set: { name: string; value: string }[]) =>
  `smg_session=${set.find((c) => c.name === 'smg_session')?.value ?? ''}`;

// Waits for the socket's disconnect, or answers 'still connected' after 3 s.
const closed = (s: Socket) =>
  new Promise<string>((resolve) => {
    s.on('disconnect', (reason) => {
      resolve(reason);
    });
    setTimeout(() => {
      resolve('still connected');
    }, 3_000);
  });

async function csrfOf(cookie: string): Promise<string> {
  const r = await inject({ method: 'GET', url: '/api/v1/session', headers: { cookie } });
  return r.json<{ csrfToken: string }>().csrfToken;
}

describe('per-address limits and session retention', () => {
  it('limits guest sessions and requests without a session per address', async () => {
    const guest = () =>
      inject({ method: 'POST', url: '/api/v1/auth/guest', payload: {}, remoteAddress: '10.9.0.1' });
    for (let i = 0; i < 10; i += 1) expect((await guest()).statusCode).toBe(201);
    expect((await guest()).statusCode).toBe(429);
    const anonymous = () =>
      inject({ method: 'GET', url: '/api/v1/session', remoteAddress: '10.9.0.2' });
    // 600 a minute, refilled as time passes: well within 700 requests one is refused.
    const answers: number[] = [];
    for (let i = 0; i < 700; i += 1) answers.push((await anonymous()).statusCode);
    expect(answers).toContain(429);
  });

  it('purges revoked and expired sessions, keeps live ones', async () => {
    const live = await signIn(kit.harness.built.fastify, 'player-3');
    const pool = kit.harness.pool;
    await pool.query(
      `INSERT INTO smg.sessions (token_hash, csrf_token, kind, expires_at, idle_expires_at)
       VALUES (decode('aa', 'hex'), 'x', 'guest', now() - interval '1 minute', now() + interval '1 day'),
              (decode('bb', 'hex'), 'x', 'guest', now() + interval '1 day', now() - interval '1 minute')`,
    );
    expect(await purgeDeadSessions(pool)).toBeGreaterThanOrEqual(2);
    const left = await pool.query(
      "SELECT 1 FROM smg.sessions WHERE token_hash IN (decode('aa','hex'), decode('bb','hex'))",
    );
    expect(left.rowCount).toBe(0);
    expect((await live.get('/api/v1/session')).json<{ signedIn: boolean }>().signedIn).toBe(true);
  });
});

describe('sockets', () => {
  it('closes the socket at logout', async () => {
    const client = await signIn(kit.harness.built.fastify, 'player-3');
    const s = kit.open(client.cookie);
    expect(await kit.connected(s)).toBe('ok');
    const done = closed(s);
    expect((await client.post('/api/v1/auth/logout', {})).statusCode).toBe(204);
    expect(await done).toBe('io server disconnect');
  });

  it('closes the socket when the account is deleted', async () => {
    const r = await inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'sec-gone@example.com', displayName: 'sec-gone', password: PASSWORD },
      remoteAddress: '10.9.0.3',
    });
    const cookie = cookieOf(r.cookies);
    const s = kit.open(cookie);
    expect(await kit.connected(s)).toBe('ok');
    const done = closed(s);
    const del = await inject({
      method: 'DELETE',
      url: '/api/v1/me',
      headers: { cookie, 'x-csrf-token': await csrfOf(cookie) },
      payload: { password: PASSWORD },
    });
    expect(del.statusCode).toBe(204);
    expect(await done).toBe('io server disconnect');
  });

  it('refuses a handshake from another origin or without a session', async () => {
    const cookie = kit.clients['player-1'].cookie;
    expect(await kit.connected(kit.open(cookie, 'https://evil.example'))).toBe(
      'ORIGIN_NOT_ALLOWED',
    );
    expect(await kit.connected(kit.open(null))).toBe('UNAUTHORIZED');
    expect(await kit.connected(kit.open(cookie))).toBe('ok');
  });
});

describe('the session cookie', () => {
  it('scopes the cookie to the base path and clears it with Secure', async () => {
    await registerAccount(kit.harness.pool, {
      email: 'sec-scoped@example.com',
      displayName: 'sec-scoped',
      password: PASSWORD,
    });
    const app = await buildOn(kit.harness.pool, kit.harness.container.getConnectionUri(), {
      NODE_ENV: 'production',
      SMG_DEV: '0',
      SMG_ROUND_KEY: 'ab'.repeat(32),
      SMG_BASE_PATH: '/games/mini-games/',
    });
    try {
      const base = '/games/mini-games/api/v1';
      const login = await app.fastify.inject({
        method: 'POST',
        url: `${base}/auth/login`,
        payload: { email: 'sec-scoped@example.com', password: PASSWORD },
      });
      const set = String(login.headers['set-cookie']);
      expect(set).toMatch(/^__Secure-smg_session=[\w-]+;/);
      for (const part of ['Path=/games/mini-games;', 'HttpOnly', 'Secure', 'SameSite=Lax'])
        expect(set).toContain(part);
      const cookie = set.split(';')[0] ?? '';
      const session = await app.fastify.inject({
        method: 'GET',
        url: `${base}/session`,
        headers: { cookie },
      });
      const out = await app.fastify.inject({
        method: 'POST',
        url: `${base}/auth/logout`,
        headers: { cookie, 'x-csrf-token': session.json<{ csrfToken: string }>().csrfToken },
        payload: {},
      });
      expect(String(out.headers['set-cookie'])).toMatch(
        /^__Secure-smg_session=; .*Path=\/games\/mini-games.*Secure/,
      );
    } finally {
      await app.fastify.close();
    }
  });
});

describe('lifetimes, headers and metrics', () => {
  it('gives an admin account a 30-minute idle and 8-hour absolute session', async () => {
    await signIn(kit.harness.built.fastify, 'admin');
    const rows = await kit.harness.pool.query<{ kind: string; idle: number; absolute: number }>(
      `SELECT s.kind, extract(epoch FROM s.idle_expires_at - now())::int AS idle,
              extract(epoch FROM s.expires_at - now())::int AS absolute
         FROM smg.sessions s JOIN smg.accounts a ON a.id = s.account_id
        WHERE a.display_name = 'dev-admin' AND s.revoked_at IS NULL`,
    );
    expect(rows.rows.length).toBeGreaterThan(0);
    for (const s of rows.rows) {
      expect(s.kind).toBe('admin');
      expect(s.idle).toBeLessThanOrEqual(30 * 60);
      expect(s.absolute).toBeLessThanOrEqual(8 * 3600);
    }
  });

  it('sends the Permissions-Policy and keeps /metrics from proxied requests', async () => {
    for (const url of ['/healthz', '/api/v1/session', '/']) {
      expect((await inject({ method: 'GET', url })).headers['permissions-policy']).toBe(
        'camera=(), microphone=(), geolocation=(), payment=()',
      );
    }
    expect((await inject({ method: 'GET', url: '/metrics' })).statusCode).toBe(200);
    const proxied = await inject({
      method: 'GET',
      url: '/metrics',
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    expect(proxied.statusCode).toBe(404);
  });
});

// A round of the host and player-1 that player-1 wins; its match's code.
async function wonRound(): Promise<{ code: string; id: string }> {
  const code = await kit.openMatch(['player-1']);
  opened.push(code);
  for (const who of ['host', 'player-1'] as const) {
    const s = kit.open(kit.clients[who].cookie);
    expect(await kit.connected(s)).toBe('ok');
    expect((await kit.send(s, 'match.watch', { code })).ok).toBe(true);
  }
  const r = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
    settings: { 'round.cooldownS': 3, 'round.countdownS': 3, 'round.specialOn': false },
    season: 'spring',
    startNow: true,
  });
  const id = r.json<{ id: string }>().id;
  const state = await kit.clients['player-1'].get(`/api/v1/rounds/${id}/state`);
  const opensAt = state.json<{ opensAt: number }>().opensAt;
  await new Promise((done) => setTimeout(done, Math.max(0, opensAt - Date.now()) + 50));
  const secrets = await kit.secretsOf(id);
  const value = secrets.mode === 'shared' ? secrets.value : 0;
  const won = await kit.clients['player-1'].post(`/api/v1/rounds/${id}/guesses`, { value });
  expect(won.json<unknown>()).toMatchObject({ ok: true });
  return { code, id };
}

describe('what anonymous viewers see', () => {
  it('shows no e-mail anywhere, and no account id on the boards and profiles', async () => {
    const { code, id } = await wonRound();
    const ids = [await kit.accountId('host'), await kit.accountId('player-1')];
    const get = async (url: string) => {
      const r = await inject({ method: 'GET', url });
      expect([url, r.statusCode]).toEqual([url, 200]);
      return r.body;
    };
    const period = JSON.parse(await get('/api/v1/leaderboards')) as { periods: { id: string }[] };
    const boards = [
      '/api/v1/leaderboards',
      `/api/v1/leaderboards/${period.periods[0]?.id ?? ''}`,
      `/api/v1/leaderboards/${period.periods[0]?.id ?? ''}/teams`,
      '/api/v1/players/dev-player-1',
    ];
    for (const url of boards) {
      const body = await get(url);
      expect(body).not.toContain('@');
      for (const accountId of ids) expect([url, body.includes(accountId)]).toEqual([url, false]);
    }
    const round = `/api/v1/rounds/${id}`;
    for (const url of [`/api/v1/matches/${code}`, `${round}/result`, `${round}/verify`]) {
      expect(await get(url)).not.toContain('@');
    }
  }, 60_000);
});

describe('client paths', () => {
  it('answers 400 for a broken %-escape and decodes a client path only once', async () => {
    const web = mkdtempSync(path.join(tmpdir(), 'smg-web-'));
    writeFileSync(path.join(web, 'index.html'), '<!doctype html>');
    const app = await buildOn(kit.harness.pool, kit.harness.container.getConnectionUri(), {
      SMG_WEB_DIR: web,
    });
    try {
      const status = async (url: string) =>
        (await app.fastify.inject({ method: 'GET', url })).statusCode;
      expect(await status('/assets/%E0%A4%A')).toBe(400);
      // Decoded once by the router: "%25zz" names the file "%zz", which is not there.
      expect(await status('/assets/%25zz')).toBe(404);
    } finally {
      await app.fastify.close();
      rmSync(web, { recursive: true, force: true });
    }
  });
});
