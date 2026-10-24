/**
 * @file   apps/server/src/http/routes/quickTest.ts
 * @module server/http
 * @brief  POST /api/v1/dev/quicktest: start a Quick Test round against bots.
 *
 * Responsibility: validate the body with zod and start the Quick Test for the signed-in
 *                 player. Registered only in development builds (SMG_DEV=1), like every
 *                 development route. Replaces Bingo's in-memory runner of the same name.
 * Depends on:     fastify, zod, ../../dev/quickTest, ../../match/play
 * Used by:        ../app
 * Spec:           docs/spec/11-roadmap.md (phase 1 Quick Test); docs/spec/09-testing-strategy.md §1
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { startQuickTest } from '../../dev/quickTest.js';
import type { Play } from '../../match/play.js';

const body = z
  .object({
    gameId: z.string().min(1).max(40).default('guess-the-number'),
    mode: z.enum(['shared', 'individual']).default('shared'),
    bots: z.number().int().min(1).max(50).default(3),
    cooldownS: z.number().int().min(3).max(60).default(3),
    visibility: z.enum(['own', 'numbers', 'full']).default('full'),
    // A short search for a quick look: 1 to this (at least 10 numbers).
    rangeHigh: z.number().int().min(10).max(1_000_000).default(1_000),
    // The fast test profile (09 §4): specials every few seconds. On by default here.
    fast: z.boolean().default(true),
    halving: z.boolean().default(false),
    seedText: z.string().trim().min(1).max(64).optional(),
    season: z.enum(['spring', 'summer', 'autumn', 'winter']).optional(),
  })
  .strict();

export function registerQuickTest(
  app: FastifyInstance,
  deps: { readonly play: Play; readonly pool: Parameters<typeof startQuickTest>[1] },
): void {
  app.post('/api/v1/dev/quicktest', async (request, reply) => {
    const accountId = request.session?.accountId ?? null;
    if (accountId === null) return reply.status(401).send({ code: 'SIGN_IN_REQUIRED' });
    const parsed = body.safeParse(request.body ?? {});
    if (!parsed.success) return reply.status(400).send({ code: 'VALIDATION_FAILED' });
    if (!deps.play.rounds.hasGame(parsed.data.gameId)) {
      return reply.status(422).send({ code: 'GAME_UNKNOWN' });
    }
    const started = await startQuickTest(deps.play, deps.pool, {
      ...parsed.data,
      playerId: accountId,
    });
    return reply.status(201).send(started);
  });
}
