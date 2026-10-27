/**
 * @file   apps/server/src/http/routes/handoff.ts
 * @module server/http
 * @brief  The JWT handoff: a host-signed token exchanged once for a first-party session.
 *
 * Responsibility: `POST /api/v1/auth/handoff {token}` from the game's own pages or, with CORS
 *                 and credentials, from an allowlisted origin that may hand off a sign-in (any
 *                 other Origin is refused); rate-limited per address; a refused token is one
 *                 uniform 401. `GET /auth/handoff` takes the one-time redirect form
 *                 `/auth/handoff#token=…` to the client, which posts the fragment (Bingo 07 §2.2).
 * Depends on:     fastify, @smg/contracts (HandoffBody), ../../auth/*, ../../integration/*, ./auth, ./cors
 * Used by:        ../app
 * Spec:           docs/spec/07-integration.md §1, §4; Bingo 07 §2.2, §3.4
 */
import { HandoffBody } from '@smg/contracts';
import type { FastifyInstance } from 'fastify';

import { recordLogin } from '../../auth/accounts.js';
import { RATE_RULES, RateLimiter } from '../../auth/rateLimit.js';
import type { SessionEnds } from '../../auth/sessionEnds.js';
import type { CookieConfig } from '../../auth/sessionPlugin.js';
import type { DbPool } from '../../db/pool.js';
import type { EmbedAllowlist } from '../../integration/embedOrigins.js';
import { redeemHandoff } from '../../integration/handoff.js';
import { HandoffRefused } from '../../integration/jwt.js';
import type { ProviderKeys } from '../../integration/keys.js';
import { startSession } from './auth.js';
import { allowCors, registerPreflight } from './cors.js';

interface HandoffRouteDeps {
  readonly pool: DbPool;
  readonly keys: ProviderKeys;
  readonly embeds: EmbedAllowlist;
  // The game's own client origins (they need no CORS).
  readonly ownOrigins: readonly string[];
  readonly cookie: CookieConfig;
  readonly sessionEnds: SessionEnds;
}

const PATH = '/api/v1/auth/handoff';

export function registerHandoffRoutes(app: FastifyInstance, deps: HandoffRouteDeps): void {
  const limit = new RateLimiter(RATE_RULES.handoff);
  const handoffSite = (origin: string) => deps.embeds.allowsHandoff(origin);
  registerPreflight(app, PATH, handoffSite);

  app.post(PATH, async (request, reply) => {
    const origin = request.headers.origin;
    const own = origin === undefined || deps.ownOrigins.includes(origin);
    if (!own && !allowCors(request, reply, handoffSite, true)) {
      return reply.status(403).send({ code: 'ORIGIN_NOT_ALLOWED' });
    }
    if (!limit.take(request.ip).allowed) return reply.status(429).send({ code: 'RATE_LIMITED' });
    const body = HandoffBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    let accountId: string;
    try {
      accountId = await redeemHandoff(deps, body.data.token);
    } catch (error) {
      if (!(error instanceof HandoffRefused)) throw error;
      // The reason is for the operator only; the caller learns nothing about the token.
      request.log.info({ reason: error.message }, 'handoff refused');
      return reply.status(401).send({ code: 'HANDOFF_REFUSED' });
    }
    await recordLogin(deps.pool, accountId);
    return startSession(request, reply, deps, { accountId, status: 200 });
  });

  // Relative, so it holds under a base path; the browser keeps the fragment on a redirect.
  app.get('/auth/handoff', (_request, reply) => reply.redirect('../?handoff'));
}
