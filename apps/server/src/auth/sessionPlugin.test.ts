/**
 * @file   apps/server/src/auth/sessionPlugin.test.ts
 * @module server/auth
 * @brief  The session cookie and the "where did this write come from" check, without a database.
 *
 * Responsibility: the cookie is named and scoped as 03 §3 says and lives as long as its
 *                 session; a state-changing API call that names another site, or nobody, is
 *                 CSRF_INVALID, one from the game's own page passes on; in website mode the
 *                 public address's host counts, whatever Host the proxy sends; the handoff, and
 *                 it alone, may also come from an allowlisted origin as the list is now.
 * Depends on:     vitest, fastify, ./sessionPlugin
 * Spec:           Bingo 03 §3, §8; DECISIONS T430
 */
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import type { DbPool } from '../db/pool.js';
import {
  cookieConfig,
  registerSessions,
  setSessionCookie,
  type SessionGuard,
} from './sessionPlugin.js';

const LOCAL: SessionGuard = {
  signInPath: null,
  trustedProxies: [],
  publicHost: null,
  handoffOrigins: () => [],
};

// The status of a POST with these headers: 200 when the hook lets it through.
async function post(url: string, headers: Record<string, string>, guard = LOCAL): Promise<number> {
  const app = Fastify();
  // No request of this test carries a cookie, so the database is never asked.
  await registerSessions(app, {} as unknown as DbPool, cookieConfig(false), guard);
  for (const path of ['/api/v1/auth/guest', '/api/v1/auth/handoff']) {
    app.post(path, () => ({ ok: true }));
  }
  const answer = await app.inject({ method: 'POST', url, headers, payload: {} });
  await app.close();
  return answer.statusCode;
}

const guest = '/api/v1/auth/guest';
const host = 'game.example';

describe('the session cookie', () => {
  it('is __Host- at the root, __Secure- under a base path, plain in development', () => {
    expect(cookieConfig(true).name).toBe('__Host-smg_session');
    expect(cookieConfig(true, '/games/mini-games/')).toEqual({
      name: '__Secure-smg_session',
      secure: true,
      path: '/games/mini-games',
    });
    expect(cookieConfig(false).name).toBe('smg_session');
  });

  it('lives as long as its session: 7 days, 30 days, an admin 8 hours', async () => {
    const app = Fastify();
    await registerSessions(app, {} as unknown as DbPool, cookieConfig(true), LOCAL);
    app.get('/set/:seconds', (request, reply) => {
      const seconds = Number((request.params as { seconds: string }).seconds);
      setSessionCookie(reply, cookieConfig(true), { token: 't', absoluteDays: seconds / 86_400 });
      return {};
    });
    for (const seconds of [7 * 86_400, 30 * 86_400, 8 * 3_600]) {
      const r = await app.inject({ url: `/set/${String(seconds)}` });
      expect(r.cookies[0]?.maxAge).toBe(seconds);
    }
    await app.close();
  });
});

describe('where a write came from', () => {
  it('lets the own page through and refuses another site or nobody', async () => {
    expect(await post(guest, { host, origin: `https://${host}` })).toBe(200);
    expect(await post(guest, { host, 'sec-fetch-site': 'same-origin' })).toBe(200);
    expect(await post(guest, { host, origin: 'https://evil.example' })).toBe(403);
    expect(await post(guest, { host, 'sec-fetch-site': 'same-site' })).toBe(403);
    expect(await post(guest, { host })).toBe(403);
  });

  it("judges the Origin by the public host in website mode, whatever the proxy's Host", async () => {
    const website: SessionGuard = { ...LOCAL, publicHost: host };
    const behind = { host: '127.0.0.1:3920', 'x-forwarded-host': 'evil.example' };
    expect(await post(guest, { ...behind, origin: `https://${host}` }, website)).toBe(200);
    expect(await post(guest, { ...behind, origin: 'https://evil.example' }, website)).toBe(403);
  });

  it('lets an allowlisted origin make the handoff, and nothing else', async () => {
    const origin = 'https://host.example';
    const cross = { host, origin, 'sec-fetch-site': 'cross-site' };
    const listed: string[] = [];
    const guard: SessionGuard = { ...LOCAL, handoffOrigins: () => listed };
    const handoff = '/api/v1/auth/handoff';
    expect(await post(handoff, cross, guard)).toBe(403);
    listed.push(origin, 'not an origin');
    expect(await post(handoff, cross, guard)).toBe(200);
    expect(await post(`${handoff}?x=1`, cross, guard)).toBe(200);
    expect(await post(handoff, { host, origin: 'https://evil.example' }, guard)).toBe(403);
    expect(await post(guest, cross, guard)).toBe(403);
    // The game's own pages write to it as to any route.
    expect(await post(handoff, { host, origin: `https://${host}` }, guard)).toBe(200);
  });
});
