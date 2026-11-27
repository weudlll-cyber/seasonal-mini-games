/**
 * @file   apps/server/src/http/routes/health.ts
 * @module server/http
 * @brief  Liveness and readiness endpoints.
 *
 * Responsibility: the kit's `HEALTH_PATHS` (T432): /healthz answers 200 as long as the process
 *                 is alive; /readyz gives the kit's `readiness` answer, 200 only when the
 *                 database responds in time (05 §2.5), else 503. Both are unauthenticated and
 *                 return minimal bodies. In website mode a ready answer also names the last
 *                 successful poll of the website's account-changes feed
 *                 (`websiteFeed.lastSuccessAt`, ISO time or null), which `smg status` reports
 *                 (DECISIONS T218); a stale feed never makes the server unready.
 * Depends on:     fastify, @seasonal/kit/server (HEALTH_PATHS, readiness), ../../db/pool,
 *                 ../../integration/accountFeed
 * Used by:        ../app.ts
 * Spec:           Bingo 05 §2.5, Bingo 08 §4
 */
import { HEALTH_PATHS, readiness } from '@seasonal/kit/server';
import type { FastifyInstance } from 'fastify';

import { pingDatabase, type DbPool } from '../../db/pool.js';
import { feedLastSuccess } from '../../integration/accountFeed.js';

export function registerHealth(app: FastifyInstance, pool: DbPool, websiteFeed: boolean): void {
  // What website mode adds to a ready answer.
  const extra = async () => {
    const at = await feedLastSuccess(pool);
    return { websiteFeed: { lastSuccessAt: at?.toISOString() ?? null } };
  };
  app.get(HEALTH_PATHS.live, () => ({ status: 'ok' }));

  app.get(HEALTH_PATHS.ready, async (_request, reply) => {
    const answer = await readiness(() => pingDatabase(pool), websiteFeed ? { extra } : {});
    if (answer.error !== undefined) {
      app.log.warn({ err: answer.error }, 'readyz: database probe failed');
    }
    return reply.status(answer.code).send(answer.body);
  });
}
