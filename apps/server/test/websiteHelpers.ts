/**
 * @file   apps/server/test/websiteHelpers.ts
 * @module server/test
 * @brief  Website mode test helpers: the settings, the proxy's sign-in request, the session.
 *
 * Responsibility: the website-mode settings under /games/mini-games/ (the test runner's address
 *                 as the trusted proxy, a proxy secret, a feed address and token), the identity
 *                 headers of a member (steps encoded as the website does), the proxy's request
 *                 for GET <base>auth/website (peer, `next`, the proxy secret and extra headers
 *                 adjustable), the session cookie of a response, GET /session and a signed-in
 *                 client's write. Adapted from Bingo's websiteHelpers.ts.
 * Depends on:     fastify (types), @smg/contracts (types), ../src/index (types)
 * Used by:        ./website.integration.test, ./websiteFeed.integration.test,
 *                 ./authzWebsite.integration.test
 * Spec:           docs/spec/07-integration.md §7
 */
import type { PlayerStepView, SessionView } from '@smg/contracts';
import type { LightMyRequestResponse } from 'fastify';

import type { App } from '../src/index.js';

export const BASE = '/games/mini-games/';
export const ORIGIN = 'https://example.org';
export const SECRET = '5e'.repeat(32);
export const SYNC_TOKEN = 'sync-token-for-the-tests-only-0123456789';
export const WEBSITE = {
  SMG_DEV: '0',
  SMG_AUTH_MODE: 'website',
  SMG_BASE_PATH: BASE,
  SMG_PUBLIC_URL: `${ORIGIN}${BASE}`,
  SMG_TRUSTED_PROXIES: '127.0.0.1',
  SMG_WEBSITE_PROXY_SECRET: SECRET,
  SMG_WEBSITE_LOCAL_URL: 'http://127.0.0.1:9',
  SMG_WEBSITE_SYNC_TOKEN: SYNC_TOKEN,
};

export interface Member {
  readonly id: string;
  readonly name: string;
  readonly roles?: string;
  readonly verified?: 'true' | 'false';
  readonly canHost?: 'true' | 'false';
  readonly steps?: readonly PlayerStepView[];
}

export const headersOf = (m: Member): Record<string, string> => ({
  'x-acting-user-id': m.id,
  'x-acting-user': m.name,
  'x-acting-user-roles': m.roles ?? 'member',
  'x-acting-user-email-verified': m.verified ?? 'true',
  'x-acting-user-can-host': m.canHost ?? 'false',
  ...(m.steps === undefined
    ? {}
    : { 'x-acting-user-steps': Buffer.from(JSON.stringify(m.steps)).toString('base64url') }),
});

interface Via {
  readonly peer?: string;
  readonly next?: string;
  // The proxy secret header's value; null leaves the header out.
  readonly secret?: string | null;
  readonly headers?: Record<string, string>;
}

// The proxy's request for the sign-in route; a member's headers, or the given ones alone.
export function viaProxy(app: App, who: Member | null, via: Via = {}) {
  const { peer = '127.0.0.1', next = `${BASE}#/`, secret = SECRET } = via;
  return app.fastify.inject({
    method: 'GET',
    url: `${BASE}auth/website?next=${encodeURIComponent(next)}`,
    headers: {
      ...(who === null ? {} : headersOf(who)),
      ...(secret === null ? {} : { 'x-smg-proxy-secret': secret }),
      ...via.headers,
    },
    remoteAddress: peer,
  });
}

export const cookieOf = (r: LightMyRequestResponse): string | null => {
  const c = r.cookies.find((x) => x.name.endsWith('smg_session'));
  return c === undefined ? null : `${c.name}=${c.value}`;
};

export async function sessionOf(
  app: App,
  cookie: string | null,
  extra: Record<string, string> = {},
): Promise<SessionView> {
  const r = await app.fastify.inject({
    method: 'GET',
    url: `${BASE}api/v1/session`,
    headers: { ...(cookie === null ? {} : { cookie }), ...extra },
  });
  return r.json<SessionView>();
}

// A member signed in through the proxy: the cookie and the session.
export async function signedIn(app: App, m: Member) {
  const r = await viaProxy(app, m);
  if (r.statusCode !== 302) throw new Error(`sign-in answered ${String(r.statusCode)}`);
  const cookie = cookieOf(r);
  return { cookie, session: await sessionOf(app, cookie) };
}

// A call with the session's cookie and CSRF token, as the client makes it: a GET, or a POST
// with the payload.
export function callWith(
  app: App,
  who: { readonly cookie: string | null; readonly session: SessionView },
  path: string,
  payload?: object,
) {
  return app.fastify.inject({
    method: payload === undefined ? 'GET' : 'POST',
    url: `${BASE}api/v1/${path}`,
    headers: { cookie: who.cookie ?? '', 'x-csrf-token': who.session.csrfToken ?? '' },
    ...(payload === undefined ? {} : { payload }),
  });
}
