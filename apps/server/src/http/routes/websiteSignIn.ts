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
 *                 address. The checks are the kit's (`websiteSignInCheck` with the game's header
 *                 names and steps 'each', `safeNext`, `websiteLoginLocation`); the route, the
 *                 accounts and the sessions are the game's. Adapted from Bingo's websiteSignIn.ts.
 * Depends on:     fastify, @seasonal/kit/server, ../../auth/websiteAccounts, ./auth,
 *                 ../../auth/sessionPlugin (types), @seasonal/kit/server (SessionEnds, RateLimiter), ../../auth/sessions,
 *                 ../../auth/rateRules, ../../config/env (types), ../../db/pool (types)
 * Used by:        ../app
 * Spec:           docs/spec/07-integration.md §7; docs/spec/05-security-threat-model.md §1;
 *                 Bingo 07 §2.3; Bingo 03 §2.2
 */
import {
  RateLimiter,
  safeNext,
  type SessionEnds,
  websiteLoginLocation,
  websiteSignInCheck,
} from '@seasonal/kit/server';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { RATE_RULES } from '../../auth/rateRules.js';
import type { CookieConfig } from '../../auth/sessionPlugin.js';
import { findSession, WEBSITE_SESSION_DAYS } from '../../auth/sessions.js';
import { websiteAccount } from '../../auth/websiteAccounts.js';
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

// The website's login with the sign-in route and the wanted page as its return path (encoded
// twice: the page is a parameter of the sign-in route, which is the login's parameter; D43).
function toLogin(reply: FastifyReply, env: Env, next: unknown) {
  reply.header('cache-control', 'no-store');
  const login = websiteLoginLocation(env.SMG_WEBSITE_LOGIN_PATH, env.SMG_BASE_PATH, next);
  return reply.redirect(login, 302);
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
  // checkWebsiteMode (../../config/env) makes sure the public address and the secret are set.
  const check = websiteSignInCheck({
    trustedProxies: env.SMG_TRUSTED_PROXIES,
    proxySecret: env.SMG_WEBSITE_PROXY_SECRET ?? '',
    secretHeader: 'x-smg-proxy-secret',
    // A bad step is dropped, never the sign-in (as before the kit).
    steps: 'each',
    names: {
      id: env.SMG_WEBSITE_HEADER_ID,
      name: env.SMG_WEBSITE_HEADER_NAME,
      roles: env.SMG_WEBSITE_HEADER_ROLES,
      emailVerified: env.SMG_WEBSITE_HEADER_EMAIL_VERIFIED,
      canHost: env.SMG_WEBSITE_HEADER_CAN_HOST,
      steps: env.SMG_WEBSITE_HEADER_STEPS,
      guest: env.SMG_WEBSITE_HEADER_GUEST,
    },
  });
  const issuer = new URL(env.SMG_PUBLIC_URL ?? '').origin;
  return async (request: FastifyRequest<NextQuery>, reply: FastifyReply) => {
    // The TCP peer, never Fastify's request.ip (a forwarding header): only the website's
    // proxy may name a visitor, and only with the proxy secret.
    const decision = check(request.socket.remoteAddress, request.headers);
    if (decision.kind === 'untrusted') return reply.status(403).send({ code: 'UNTRUSTED_PROXY' });
    // The website answers every visitor; a guest (signed out, locked, no 2FA) goes to its login.
    if (decision.kind === 'guest') return toLogin(reply, env, request.query.next);
    if (decision.kind === 'invalid') return reply.status(403).send({ code: 'NO_WEBSITE_USER' });
    const accountId = await websiteAccount(deps.pool, issuer, decision.identity);
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
