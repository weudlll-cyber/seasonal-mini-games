/**
 * @file   apps/server/test/websiteSecurity.integration.test.ts
 * @module server/test
 * @brief  Website mode: forged headers sign nobody in, `next` stays on the base path, guests (O66).
 *
 * Responsibility: a server in website mode under /games/mini-games/ and one in local mode on
 *                 the same database. The identity headers sign nobody in from an untrusted
 *                 peer, without the proxy secret, with a wrong one, on any other route (a
 *                 client's X-Acting-User* on GET /session or the guest route), or on a server in
 *                 local mode (the route does not exist there); a trusted request without a valid
 *                 identity is 403, one the website names a guest goes on to its login, as
 *                 GET <base>auth/website/login does. A `next` with a scheme, a host, "//" or a
 *                 backslash goes to the lobby. Registration, password sign-in, the password
 *                 change and the dev sign-in answer 404 in website mode; local mode keeps them
 *                 and reports itself. A guest session watches and reads the boards, every
 *                 action asks for a sign-in. Adapted from Bingo's websiteLogin and websiteRules tests.
 * Depends on:     vitest, ../src/index (types), ./harness, ./websiteHelpers
 * Spec:           docs/spec/07-integration.md §7; docs/spec/05-security-threat-model.md §1;
 *                 Bingo 07 §2.3; Bingo 03 §2.2
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { App } from '../src/index.js';
import { buildOn, startHarness, stopHarness, SUITE_TIMEOUT_MS, type Harness } from './harness.js';
import {
  BASE,
  callWith,
  cookieOf,
  headersOf,
  sessionOf,
  viaProxy,
  WEBSITE,
} from './websiteHelpers.js';

let harness: Harness;
let local: App;
const website = () => harness.built;
const member = { id: '7', name: 'Mallory', roles: 'admin', canHost: 'true' as const };
// Where a refused or guest sign-in goes: the website's login, back through the sign-in route.
const loginFor = (page: string) =>
  `/login?next=${encodeURIComponent(`${BASE}auth/website?next=${encodeURIComponent(page)}`)}`;

beforeAll(async () => {
  harness = await startHarness(WEBSITE);
  local = await buildOn(harness.pool, harness.container.getConnectionUri());
}, SUITE_TIMEOUT_MS);
afterAll(async () => {
  await local.fastify.close();
  await stopHarness(harness);
}, SUITE_TIMEOUT_MS);

const post = (app: App, url: string, payload: object) =>
  app.fastify.inject({
    method: 'POST',
    url: app === local ? `/api/v1/${url}` : `${BASE}api/v1/${url}`,
    payload,
  });

// A guest session of the website-mode server, as the client starts one for a visitor.
async function guestSession() {
  const cookie = cookieOf(await post(website(), 'auth/guest', {}));
  return { cookie, session: await sessionOf(website(), cookie) };
}

describe('forged identity headers (O66)', () => {
  it('sign nobody in from an untrusted peer, without the secret or with a wrong one', async () => {
    const answers = [
      await viaProxy(website(), member, { peer: '10.0.0.9' }),
      await viaProxy(website(), member, { secret: null }),
      await viaProxy(website(), member, { secret: 'not-the-secret' }),
    ];
    expect(answers.map((r) => r.statusCode)).toEqual([403, 403, 403]);
    expect(answers.map(cookieOf)).toEqual([null, null, null]);
  });

  it('are ignored on every other route', async () => {
    const s = await sessionOf(website(), null, headersOf(member));
    expect([s.signedIn, s.account]).toEqual([false, null]);
    const guest = await website().fastify.inject({
      method: 'POST',
      url: `${BASE}api/v1/auth/guest`,
      payload: {},
      headers: { ...headersOf(member), 'x-smg-proxy-secret': WEBSITE.SMG_WEBSITE_PROXY_SECRET },
      remoteAddress: '127.0.0.1',
    });
    const after = await sessionOf(website(), cookieOf(guest), headersOf(member));
    expect([after.kind, after.signedIn, after.permissions]).toEqual([
      'guest',
      false,
      ['match.watch'],
    ]);
  });

  it('sign nobody in on a server in local mode, where the route does not exist', async () => {
    const there = await local.fastify.inject({
      method: 'GET',
      url: '/auth/website',
      headers: headersOf(member),
      remoteAddress: '127.0.0.1',
    });
    expect(there.statusCode).toBe(404);
    expect(cookieOf(there)).toBeNull();
  });
});

describe('a trusted request without a member', () => {
  it('is refused without a valid id or name', async () => {
    const bad = await viaProxy(website(), { id: 'u-1', name: 'Nobody' });
    const nameless = await viaProxy(website(), null, { headers: { 'x-acting-user-id': '8' } });
    expect([bad.statusCode, nameless.statusCode]).toEqual([403, 403]);
    expect(bad.json()).toEqual({ code: 'NO_WEBSITE_USER' });
  });

  it('sends a guest on to the website login, as the login hop does', async () => {
    const page = `${BASE}#/match/K7Q2M`;
    const guest = await viaProxy(website(), null, {
      next: page,
      headers: { 'x-acting-guest': 'true' },
    });
    const hop = await website().fastify.inject({
      method: 'GET',
      url: `${BASE}auth/website/login?next=${encodeURIComponent(page)}`,
    });
    expect([guest.statusCode, hop.statusCode]).toEqual([302, 302]);
    expect(guest.headers.location).toBe(loginFor(page));
    expect(hop.headers.location).toBe(loginFor(page));
    expect(cookieOf(guest)).toBeNull();
  });
});

describe('the return path (Bingo D43)', () => {
  it('goes to the lobby for a scheme, a host, "//" or a backslash', async () => {
    const foreign = [
      'https://evil.example/',
      'javascript:alert(1)',
      '//evil.example/x',
      `${BASE}/evil.example`,
      `${BASE}..\\evil`,
      `${BASE}#/oké`,
    ];
    for (const [i, next] of foreign.entries()) {
      const r = await viaProxy(
        website(),
        { id: String(100 + i), name: `Nexter${String(i)}` },
        { next },
      );
      expect([next, r.headers.location]).toEqual([next, BASE]);
    }
    const hop = await website().fastify.inject({
      method: 'GET',
      url: `${BASE}auth/website/login?next=${encodeURIComponent('https://evil.example/')}`,
    });
    expect(hop.headers.location).toBe(loginFor(BASE));
  });
});

describe('what website mode switches off (O66)', () => {
  it('answers 404 for registration, password sign-in, password change and dev sign-in', async () => {
    const answers = [
      await post(website(), 'auth/register', {
        email: 'a@b.cd',
        displayName: 'abc',
        password: 'x',
      }),
      await post(website(), 'auth/login', { email: 'a@b.cd', password: 'x' }),
      await callWith(website(), await guestSession(), 'me/password', {
        current: 'x',
        next: 'y',
      }),
      await post(website(), 'dev/sign-in', { as: 'host' }),
    ];
    expect(answers.map((r) => r.statusCode)).toEqual([404, 404, 404, 404]);
  });

  it('leaves local mode as it was: the routes answer, the session says local', async () => {
    const login = await post(local, 'auth/login', { email: 'a@b.cd', password: 'x' });
    const dev = await post(local, 'dev/sign-in', { as: 'player-1' });
    expect([login.statusCode, dev.statusCode]).toEqual([401, 200]);
    const s = await local.fastify.inject({ method: 'GET', url: '/api/v1/session' });
    expect(s.json()).toMatchObject({ authMode: 'local', signInPath: null, signedIn: false });
  });
});

describe('guests (O66)', () => {
  it('watch and read the boards with a guest session; every action asks for a sign-in', async () => {
    const guest = await guestSession();
    expect(guest.session.permissions).toEqual(['match.watch']);
    for (const path of ['matches', 'leaderboards', 'games', 'seasons/current']) {
      expect([path, (await callWith(website(), guest, path)).statusCode]).toEqual([path, 200]);
    }
    const refused = [
      await callWith(website(), guest, 'matches', { gameId: 'guess-the-number' }),
      await callWith(website(), guest, 'me/matches'),
    ];
    expect(refused.map((r) => [r.statusCode, r.json<{ code: string }>().code])).toEqual([
      [401, 'SIGN_IN_REQUIRED'],
      [401, 'SIGN_IN_REQUIRED'],
    ]);
  });
});
