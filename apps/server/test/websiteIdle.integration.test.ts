/**
 * @file   apps/server/test/websiteIdle.integration.test.ts
 * @module server/test
 * @brief  Website mode: a website admin's game session idles out while the website still knows them (T282).
 *
 * Responsibility: a server in website mode with the realtime gateway. A website admin's game
 *                 session (an admin session: 30 minutes idle) is made idle in the database, as
 *                 the idle limit is fixed in SQL, not configured. Then GET /session answers
 *                 signed out, a read 401, a write 403 (no live session, so no CSRF token), each
 *                 with X-Smg-Session-Ended naming the sign-in route; the socket opened before
 *                 keeps answering (a socket keeps the session it connected with), a new socket is
 *                 refused; the sign-in route with the old cookie and the page as `next` gives a
 *                 fresh admin session and sends back to that page. A guest's ended session and
 *                 a live one carry no such header.
 * Depends on:     vitest, ../src/auth/sessionPlugin, ./harness, ./socketKit, ./websiteHelpers
 * Spec:           docs/spec/07-integration.md §7; Bingo 03 §3
 */
import type { Server } from 'socket.io';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SESSION_ENDED_HEADER } from '../src/auth/sessionPlugin.js';
import { startHarness, stopHarness, SUITE_TIMEOUT_MS, type Harness } from './harness.js';
import { connectedOf, listening, socketOpener } from './socketKit.js';
import {
  BASE,
  callWith,
  cookieOf,
  sessionOf,
  signedIn,
  viaProxy,
  WEBSITE,
} from './websiteHelpers.js';

let harness: Harness;
let io: Server;
let opener: ReturnType<typeof socketOpener>;

beforeAll(async () => {
  harness = await startHarness(WEBSITE);
  const gateway = await listening(harness);
  io = gateway.io;
  opener = socketOpener(gateway.url);
}, SUITE_TIMEOUT_MS);
afterAll(async () => {
  for (const s of opener.sockets) s.disconnect();
  await io.close();
  await stopHarness(harness);
}, SUITE_TIMEOUT_MS);

const SIGN_IN = `${BASE}auth/website`;
const ADMIN = { id: '401', name: 'Idler', roles: 'admin' };

const idleOut = (where: string, arg: string | null) =>
  harness.pool.query(
    `UPDATE smg.sessions SET idle_expires_at = now() - interval '1 second' WHERE ${where}`,
    arg === null ? [] : [arg],
  );

const get = (path: string, cookie: string | null) =>
  harness.built.fastify.inject({
    method: 'GET',
    url: `${BASE}api/v1/${path}`,
    headers: cookie === null ? {} : { cookie },
  });

describe('a website admin whose game session idled out (T282)', () => {
  it('is told to sign in again, and the sign-in brings them back to the page', async () => {
    const admin = await signedIn(harness.built, ADMIN);
    const live = opener.open(admin.cookie);
    expect(await connectedOf(live)).toBe('ok');
    await idleOut('account_id = $1', admin.session.account?.id ?? null);

    const load = await get('session', admin.cookie);
    expect(load.json<{ signedIn: boolean }>().signedIn).toBe(false);
    expect(load.headers[SESSION_ENDED_HEADER]).toBe(SIGN_IN);
    const read = await get('admin/audit', admin.cookie);
    expect([read.statusCode, read.json<{ code: string }>().code]).toEqual([
      401,
      'SIGN_IN_REQUIRED',
    ]);
    expect(read.headers[SESSION_ENDED_HEADER]).toBe(SIGN_IN);
    const made = { gameId: 'guess-the-number', title: 'idle', maxPlayers: 4 };
    const write = await callWith(harness.built, admin, 'matches', made);
    expect([write.statusCode, write.json<{ code: string }>().code]).toEqual([403, 'CSRF_INVALID']);
    expect(write.headers[SESSION_ENDED_HEADER]).toBe(SIGN_IN);

    const sync = (await live.emitWithAck('intent', { t: 'time.sync', seq: 1, data: {} })) as {
      ok: boolean;
    };
    expect(sync.ok).toBe(true);
    expect(await connectedOf(opener.open(admin.cookie))).toBe('UNAUTHORIZED');

    const page = `${BASE}admin/#/settings`;
    const again = await viaProxy(harness.built, ADMIN, {
      next: page,
      headers: { cookie: admin.cookie ?? '' },
    });
    expect([again.statusCode, again.headers.location]).toEqual([302, page]);
    const fresh = await sessionOf(harness.built, cookieOf(again));
    expect([fresh.signedIn, fresh.kind]).toEqual([true, 'admin']);
    expect((await get('session', cookieOf(again))).headers[SESSION_ENDED_HEADER]).toBeUndefined();
  });

  it('says nothing for a guest whose session ended, nor for a live session', async () => {
    const guest = await harness.built.fastify.inject({
      method: 'POST',
      url: `${BASE}api/v1/auth/guest`,
      payload: {},
    });
    await idleOut('account_id IS NULL', null);
    const ended = await get('session', cookieOf(guest));
    expect(ended.headers[SESSION_ENDED_HEADER]).toBeUndefined();
    const member = await signedIn(harness.built, { id: '402', name: 'Awake' });
    expect((await get('session', member.cookie)).headers[SESSION_ENDED_HEADER]).toBeUndefined();
  });
});
