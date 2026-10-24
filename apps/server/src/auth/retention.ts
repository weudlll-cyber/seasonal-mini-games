/**
 * @file   apps/server/src/auth/retention.ts
 * @module server/auth
 * @brief  Daily retention job: revoked and expired sessions are deleted.
 *
 * Responsibility: run the purge once at start and then every 24 hours; a failure is logged
 *                 and tried again the next day. Bingo's match/retention.ts without its
 *                 marks purge (there are no marks here).
 * Depends on:     ./sessions, ../db/pool
 * Used by:        ../main
 * Spec:           Bingo 03 §3, §19
 */
import type { DbPool } from '../db/pool.js';
import { purgeDeadSessions } from './sessions.js';

export function startRetention(pool: DbPool): () => void {
  const run = (): void => {
    purgeDeadSessions(pool).catch((error: unknown) => {
      console.error('[smg] session retention failed:', error);
    });
  };
  run();
  const timer = setInterval(run, 24 * 3600_000);
  return () => {
    clearInterval(timer);
  };
}
