/**
 * @file   apps/server/src/http/routes/health.ts
 * @module server/http
 * @brief  Liveness and readiness endpoints.
 *
 * Responsibility: /healthz answers 200 as long as the process is alive; /readyz
 *                 answers 200 only when the database responds inside a short timeout
 *                 (05 §2.5). Both are unauthenticated and return minimal bodies. In website
 *                 mode /readyz also names the last successful poll of the website's
 *                 account-changes feed (`websiteFeed.lastSuccessAt`, ISO time or null), which
 *                 `smg status` reports (DECISIONS T218); it never decides readiness.
 * Depends on:     fastify, ../../db/pool, ../../integration/accountFeed
 * Used by:        ../app.ts
 * Spec:           Bingo 05 §2.5, Bingo 08 §4
 */
import type { FastifyInstance } from 'fastify';

import { pingDatabase, type DbPool } from '../../db/pool.js';
import { feedLastSuccess } from '../../integration/accountFeed.js';

const READY_TIMEOUT_MS = 1_500;

export function registerHealth(app: FastifyInstance, pool: DbPool, websiteFeed: boolean): void {
  app.get('/healthz', () => ({ status: 'ok' }));

  app.get('/readyz', async (_request, reply) => {
    try {
      await Promise.race([pingDatabase(pool), timeoutRejection(READY_TIMEOUT_MS)]);
      if (!websiteFeed) return { status: 'ready' };
      const at = await feedLastSuccess(pool);
      return { status: 'ready', websiteFeed: { lastSuccessAt: at?.toISOString() ?? null } };
    } catch (error) {
      app.log.warn({ err: error }, 'readyz: database probe failed');
      return reply.status(503).send({ status: 'unavailable', reason: 'database' });
    }
  });
}

function timeoutRejection(ms: number): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error(`readyz probe timed out after ${String(ms)}ms`));
    }, ms).unref();
  });
}
