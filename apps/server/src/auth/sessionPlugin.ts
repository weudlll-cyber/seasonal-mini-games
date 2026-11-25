/**
 * @file   apps/server/src/auth/sessionPlugin.ts
 * @module server/auth
 * @brief  Session cookie, request.session, CSRF checks and the general API rate limit (03 §3, §8, §13).
 *
 * Responsibility: register @fastify/cookie; on every /api request load the session named
 *                 by the cookie into `request.session` (null when absent or dead); on
 *                 state-changing /api requests require the `X-CSRF-Token` header to equal
 *                 the session's token (constant-time), except the routes that create the
 *                 first session (register, login, guest, handoff, dev sign-in), which accept only
 *                 JSON bodies so a cross-site form cannot reach them. Before that, as a second
 *                 layer, the kit's `writeCheck` (T430): a state-changing call must come from the
 *                 game's own pages (`Sec-Fetch-Site`, `Origin` against the host; in website mode
 *                 the public address's host), the handoff excepted. Limit every session
 *                 to 120 API calls a minute, and requests without a session to 600 a minute
 *                 per address. The cookie's name and attributes are the kit's (03 §3:
 *                 `__Host-` at the root, `__Secure-` with the base path, plain in development);
 *                 it lives as long as its session.
 *                 Website mode: a cookie that names an ended session of an active account
 *                 (idle, expired, revoked) gets the answer header X-Smg-Session-Ended with the
 *                 sign-in route, so the clients sign in again through the website (T282).
 * Depends on:     fastify, @fastify/cookie, node:crypto, @smg/contracts (SESSION_ENDED_HEADER),
 *                 ./sessions, ./rateRules, @seasonal/kit/server (RateLimiter, sessionCookie,
 *                 sessionCookieOptions, writeCheck), ../db/pool
 * Used by:        ../http/app, ../http/routes/auth, ../http/routes/devSignIn
 * Spec:           Bingo 03 §3, §8, §13
 */
import { timingSafeEqual } from 'node:crypto';

import cookie from '@fastify/cookie';
import {
  RateLimiter,
  sessionCookie,
  type SessionCookie,
  sessionCookieOptions,
  writeCheck,
} from '@seasonal/kit/server';
import { SESSION_ENDED_HEADER } from '@smg/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { DbPool } from '../db/pool.js';
import { RATE_RULES } from './rateRules.js';
import { endedAccountSession, findSession, type NewSession, type Session } from './sessions.js';

declare module 'fastify' {
  interface FastifyRequest {
    session: Session | null;
  }
}

export type CookieConfig = SessionCookie;

export const cookieConfig = (secure: boolean, basePath = '/'): CookieConfig =>
  sessionCookie({ name: 'smg_session', secure, basePath });

export interface SessionGuard {
  // Website mode's sign-in route, else null (no X-Smg-Session-Ended).
  readonly signInPath: string | null;
  // The proxies whose X-Forwarded-Host is believed.
  readonly trustedProxies: readonly string[];
  // Website mode: the public address's host, which a browser's Origin names; the website's
  // proxy may send the game another Host. null: the request's own host counts.
  readonly publicHost: string | null;
}

// Routes that start a session: no CSRF token exists yet (03 §8, SameSite=Lax + JSON only).
const SESSION_STARTERS = new Set([
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/guest',
  '/api/v1/auth/handoff',
  '/api/v1/dev/sign-in',
]);
// Development only and outside any session: the load check's cleanup (no CSRF token).
const DEV_UNSESSIONED = new Set(['/api/v1/dev/load-accounts']);
// Called from the host sites' pages by design: it checks its own Origin allowlist
// (../http/routes/handoff).
const CROSS_ORIGIN = '/api/v1/auth/handoff';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function registerSessions(
  app: FastifyInstance,
  pool: DbPool,
  config: CookieConfig,
  guard: SessionGuard,
): Promise<void> {
  await app.register(cookie);
  app.decorateRequest('session', null);
  const apiLimit = new RateLimiter(RATE_RULES.api);
  const anonymousLimit = new RateLimiter(RATE_RULES.anonymous);
  const fromOwnPages = ownPagesCheck(guard);
  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;
    const token = request.cookies[config.name];
    request.session = token === undefined ? null : await findSession(pool, token);
    const ended = request.session === null && token !== undefined && guard.signInPath !== null;
    if (ended && (await endedAccountSession(pool, token))) {
      void reply.header(SESSION_ENDED_HEADER, guard.signInPath);
    }
    // A session is limited by its id, a request without one by its address (audit S3).
    const allowed =
      request.session === null
        ? anonymousLimit.take(request.ip).allowed
        : apiLimit.take(request.session.id).allowed;
    if (!allowed) return reply.status(429).send({ code: 'RATE_LIMITED' });
    const path = request.url.split('?')[0] ?? '';
    if (path !== CROSS_ORIGIN && !fromOwnPages(request)) {
      return reply.status(403).send({ code: 'CSRF_INVALID' });
    }
    return checkCsrf(request, reply, path);
  });
}

// The kit's writeCheck on a Fastify request: safe methods pass, a write must name this site.
function ownPagesCheck({ trustedProxies, publicHost }: SessionGuard) {
  const check = writeCheck({ trustedProxies });
  return (request: FastifyRequest): boolean => {
    const headers =
      publicHost === null
        ? request.headers
        : { ...request.headers, host: publicHost, 'x-forwarded-host': undefined };
    // The TCP peer, never request.ip (a forwarding header).
    const peer = request.socket.remoteAddress;
    const decision = check({ method: request.method, headers, peer });
    if (!decision.ok) request.log.info({ reason: decision.reason }, 'cross-site write refused');
    return decision.ok;
  };
}

async function checkCsrf(request: FastifyRequest, reply: FastifyReply, path: string) {
  if (SAFE_METHODS.has(request.method)) return;
  if (DEV_UNSESSIONED.has(path)) return;
  if (SESSION_STARTERS.has(path)) {
    if (!(request.headers['content-type'] ?? '').startsWith('application/json')) {
      await reply.status(415).send({ code: 'JSON_REQUIRED' });
    }
    return;
  }
  const sent = request.headers['x-csrf-token'];
  const expected = request.session?.csrfToken;
  if (typeof sent !== 'string' || expected === undefined || !sameToken(sent, expected)) {
    await reply.status(403).send({ code: 'CSRF_INVALID' });
  }
}

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// The cookie lives exactly as long as the session it names.
export function setSessionCookie(
  reply: FastifyReply,
  config: CookieConfig,
  session: Pick<NewSession, 'token' | 'absoluteDays'>,
): void {
  const options = sessionCookieOptions(config, session.absoluteDays);
  void reply.setCookie(config.name, session.token, options);
}

// Cleared with the same attributes it was set with (a `__Host-`/`__Secure-` cookie only
// goes away with Secure and its own path).
export function clearSessionCookie(reply: FastifyReply, config: CookieConfig): void {
  void reply.clearCookie(config.name, sessionCookieOptions(config));
}
