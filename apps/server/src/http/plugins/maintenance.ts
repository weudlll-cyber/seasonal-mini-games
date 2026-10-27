/**
 * @file   apps/server/src/http/plugins/maintenance.ts
 * @module server/http
 * @brief  Maintenance: while `smg maintenance on` holds, no new match and no new round starts.
 *
 * Responsibility: the operator's flag is the file `maintenance` in SMG_DATA_DIR (ops/smg writes
 *                 and removes it inside the app container). While it exists, opening a match,
 *                 creating a round and the development Quick Test answer 503 MAINTENANCE;
 *                 everything else goes on, so running rounds finish and their results are
 *                 written (10 §6). The file is looked at most once a second, so a request never
 *                 waits on the disk. A round created before maintenance began can still be
 *                 started: it is not new any more (DECISIONS T77).
 * Depends on:     fastify, node:fs, node:path
 * Used by:        ../app
 * Spec:           docs/spec/10-repository-structure.md §6; Bingo 09 §4
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';

// The routes that start something new (route patterns, after the base path is removed).
const STARTS = new Set([
  'POST /api/v1/matches',
  'POST /api/v1/matches/:code/rounds',
  'POST /api/v1/dev/quicktest',
]);

// Whether the flag file exists, looked up at most once per `maxAgeMs`.
export function maintenanceFlag(dataDir: string, maxAgeMs = 1_000, now = Date.now) {
  const file = path.join(dataDir, 'maintenance');
  let seen = { at: -Infinity, on: false };
  return (): boolean => {
    if (now() - seen.at >= maxAgeMs) seen = { at: now(), on: existsSync(file) };
    return seen.on;
  };
}

export function registerMaintenance(app: FastifyInstance, on: () => boolean): void {
  app.addHook('onRequest', async (request, reply) => {
    if (!STARTS.has(`${request.method} ${request.routeOptions.url ?? ''}`) || !on()) return;
    await reply.status(503).send({ code: 'MAINTENANCE' });
  });
}
