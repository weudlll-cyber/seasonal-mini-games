/**
 * @file   apps/server/src/http/routes/websiteSignIn.ts
 * @module server/http
 * @brief  GET <base>auth/website: the only place that reads the website's identity headers (O66).
 *
 * Responsibility: website mode only (../app registers it there; local mode: 404). The website's
 *                 proxy protects exactly this path with auth_request / forward_auth and passes
 *                 the visitor as headers. Accepted only from a peer in SMG_TRUSTED_PROXIES that
 *                 sends the proxy secret (X-Smg-Proxy-Secret, compared in constant time; else
 *                 403, nobody signed in). A visitor the website names a guest (X-Acting-Guest)
 *                 goes on to the website's login as from GET <base>auth/website/login
 *                 (DECISIONS T215); a member needs a valid id and name (else 403); then the
 *                 account by (site origin, user id) (../../auth/websiteAccounts; a suspended one
 *                 403), a fresh game session of at most 7 days (./auth openSession; T280; an
 *                 admin session keeps its 8 hours) and a redirect to `next` when
 *                 it is a path under the base path, else to the base path (Bingo D43).
 *                 GET <base>auth/website/login: a redirect to SMG_WEBSITE_LOGIN_PATH with the
 *                 sign-in route and `next` as return path (Bingo D43). Both rate-limited per
 *                 address. Adapted from Bingo's websiteSignIn.ts.
 * Depends on:     node:crypto, fastify, ../../auth/websiteIdentity, ../../auth/websiteAccounts, ./auth,
 *                 ../../auth/sessionPlugin (types), ../../auth/sessionEnds (types), ../../auth/sessions,
 *                 ../../auth/rateLimit, ../../config/env (types), ../../db/pool (types)
 * Used by:        ../app
 * Spec:           docs/spec/07-integration.md §7; docs/spec/05-security-threat-model.md §1;
 *                 Bingo 07 §2.3; Bingo 03 §2.2
 */
import { createHash, timingSafeEqual } from 'node:crypto';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { RATE_RULES, RateLimiter } from '../../auth/rateLimit.js';
import type { CookieConfig } from '../../auth/sessionPlugin.js';
import type { SessionEnds } from '../../auth/sessionEnds.js';
import { findSession, WEBSITE_SESSION_DAYS } from '../../auth/sessions.js';
import { websiteAccount } from '../../auth/websiteAccounts.js';
import { identityFrom, isWebsiteGuest, trustedPeers } from '../../auth/websiteIdentity.js';
import type { Env } from '../../config/env.js';
import type { DbPool } from '../../db/pool.js';
import { openSession } from './auth.js';

interface WebsiteSignInDeps {
  readonly env: Env;
  readonly pool: DbPool;
  readonly cookie: CookieConfig;
  readonly sessionEnds: SessionEnds;
}

type NextQuery = { Querystring: { next?: string } };

// Where to go after signing in: a path under the base path (the client's page, its hash
// included, percent-encoded), never another site: printable ASCII only, no "//", no backslash.
function safeNext(next: unknown, basePath: string): string {
  if (typeof next !== 'string' || next.length > 512 || !next.startsWith(basePath)) return basePath;
  return /^[\x21-\x7e]+$/.test(next) && !/\/\/|\\/.test(next) ? next : basePath;
}

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

// A test for the proxy secret header, in constant time (both sides hashed to one length).
function proxySecret(expected: string): (sent: string | string[] | undefined) => boolean {
  const want = digest(expected);
  return (sent) => typeof sent === 'string' && timingSafeEqual(digest(sent), want);
}

// The website's login with the sign-in route and the wanted page as its return path (encoded
// twice: the page is a parameter of the sign-in route, which is the login's parameter; D43).
function toLogin(reply: FastifyReply, env: Env, next: unknown) {
  const base = env.SMG_BASE_PATH;
  const back = `${base}auth/website?next=${encodeURIComponent(safeNext(next, base))}`;
  reply.header('cache-control', 'no-store');
  return reply.redirect(`${env.SMG_WEBSITE_LOGIN_PATH}${encodeURIComponent(back)}`, 302);
}

function tooMany(reply: FastifyReply) {
  return reply.status(429).send({ code: 'RATE_LIMITED' });
}

export function registerWebsiteSignIn(app: FastifyInstance, deps: WebsiteSignInDeps): void {
  const loginLimit = new RateLimiter(RATE_RULES.websiteLogin);
  app.get<NextQuery>('/auth/website/login', (request, reply) => {
    if (!loginLimit.take(request.ip).allowed) return tooMany(reply);
    return toLogin(reply, deps.env, request.query.next);
  });
  const signIn = websiteSignIn(deps);
  const signInLimit = new RateLimiter(RATE_RULES.websiteSignIn);
  app.get<NextQuery>('/auth/website', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    if (!signInLimit.take(request.ip).allowed) return tooMany(reply);
    return signIn(request, reply);
  });
}

// The sign-in itself: the proxy's checks, the account, the session, the redirect.
function websiteSignIn(deps: WebsiteSignInDeps) {
  const { env } = deps;
  const trusted = trustedPeers(env.SMG_TRUSTED_PROXIES);
  // checkWebsiteMode (../../config/env) makes sure the public address and the secret are set.
  const fromProxy = proxySecret(env.SMG_WEBSITE_PROXY_SECRET ?? '');
  const issuer = new URL(env.SMG_PUBLIC_URL ?? '').origin;
  return async (request: FastifyRequest<NextQuery>, reply: FastifyReply) => {
    // The TCP peer, not X-Forwarded-For: only the website's proxy may name a visitor.
    // And the proxy secret: another process on a trusted address names nobody.
    if (
      !trusted(request.socket.remoteAddress) ||
      !fromProxy(request.headers['x-smg-proxy-secret'])
    ) {
      return reply.status(403).send({ code: 'UNTRUSTED_PROXY' });
    }
    // The website answers every visitor; a guest (signed out, locked, no 2FA) goes to its login.
    if (isWebsiteGuest(request.headers, env)) return toLogin(reply, env, request.query.next);
    const who = identityFrom(request.headers, env);
    if (who === null) return reply.status(403).send({ code: 'NO_WEBSITE_USER' });
    const accountId = await websiteAccount(deps.pool, issuer, who);
    if (accountId === null) return reply.status(403).send({ code: 'ACCOUNT_SUSPENDED' });
    // This route is outside /api, where the session hook does not look: find the browser's
    // session here, so the new one replaces it (03 §3; Bingo audit-3 S2).
    const token = request.cookies[deps.cookie.name];
    request.session = token === undefined ? null : await findSession(deps.pool, token);
    // A game session from the website lives at most 7 days (T280); an admin's keeps 8 hours.
    await openSession(request, reply, { ...deps, playerDays: WEBSITE_SESSION_DAYS }, accountId);
    return reply.redirect(safeNext(request.query.next, env.SMG_BASE_PATH), 302);
  };
}
