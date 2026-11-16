/**
 * @file   apps/server/src/http/routes/prefs.ts
 * @module server/http
 * @brief  A match player's own value in a phased game's match (pre-picks): read and replace.
 *
 * Responsibility: 06 §3.1, 04 §4.8 rule 8. Signed in, a player of the match, their own value
 *                 only: `GET` answers it (null before the first save), `PUT { prefs }` replaces
 *                 it after the game's schema (422 PREFS_INVALID), at most once every 2 s (429),
 *                 in a game with prefs only (409 PREFS_OFF); someone not in the match is 403
 *                 FORBIDDEN.
 * Depends on:     fastify, zod, ../../match/*
 * Used by:        ./matches
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1; docs/spec/04-software-architecture.md §4.8 rule 8
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { findMatch, type MatchRow } from '../../match/matches.js';
import type { Play } from '../../match/play.js';
import type { PrefsCode } from '../../match/prefs.js';

export interface PrefsRouteDeps {
  readonly play: Play;
  readonly pool: Parameters<typeof findMatch>[0];
}

const PREFS_STATUS: Readonly<Record<PrefsCode, number>> = {
  PREFS_OFF: 409,
  PREFS_INVALID: 422,
  RATE_LIMITED: 429,
  FORBIDDEN: 403,
};

const prefsBody = z.object({ prefs: z.unknown() }).strict();

// The signed-in caller and the route's match, or null once a refusal is sent.
async function caller(
  deps: PrefsRouteDeps,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ match: MatchRow; key: string } | null> {
  const key = request.session?.accountId ?? null;
  if (key === null) {
    await reply.status(401).send({ code: 'SIGN_IN_REQUIRED' });
    return null;
  }
  const match = await findMatch(deps.pool, (request.params as { code: string }).code);
  if (match === null) {
    await reply.status(404).send({ code: 'MATCH_NOT_FOUND' });
    return null;
  }
  return { match, key };
}

export function registerPrefsRoutes(app: FastifyInstance, deps: PrefsRouteDeps): void {
  app.get('/api/v1/matches/:code/prefs', async (request, reply) => {
    const who = await caller(deps, request, reply);
    if (who === null) return reply;
    if (!(await deps.play.prefs.isPlayer(who.match, who.key))) {
      return reply.status(403).send({ code: 'FORBIDDEN' });
    }
    return { prefs: await deps.play.prefs.own(who.match, who.key) };
  });

  app.put('/api/v1/matches/:code/prefs', async (request, reply) => {
    const body = prefsBody.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    const who = await caller(deps, request, reply);
    if (who === null) return reply;
    const refused = await deps.play.prefs.save(who.match, who.key, body.data.prefs);
    if (refused !== null) return reply.status(PREFS_STATUS[refused]).send({ code: refused });
    return reply.status(204).send();
  });
}
