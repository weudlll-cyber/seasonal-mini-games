/**
 * @file   apps/server/src/auth/retention.ts
 * @module server/auth
 * @brief  Retention jobs: revoked and expired sessions daily, spent handoff `jti`s hourly.
 *
 * Responsibility: run each purge once at start and then on its interval; a failure is logged
 *                 and tried again next time. Bingo's match/retention.ts without its marks purge
 *                 (there are no marks here), plus the replay cache of the handoff (Bingo 04 §3.6).
 * Depends on:     ./sessions, ../integration/handoff, ../db/pool
 * Used by:        ../main
 * Spec:           Bingo 03 §3, §4, §19
 */
import type { DbPool } from '../db/pool.js';
import { purgeReplayCache } from '../integration/handoff.js';
import { purgeDeadSessions } from './sessions.js';

function every(ms: number, what: string, purge: () => Promise<unknown>): () => void {
  const run = (): void => {
    purge().catch((error: unknown) => {
      console.error(`[smg] ${what} retention failed:`, error);
    });
  };
  run();
  const timer = setInterval(run, ms);
  return () => {
    clearInterval(timer);
  };
}

export function startRetention(pool: DbPool): () => void {
  const stops = [
    every(24 * 3600_000, 'session', () => purgeDeadSessions(pool)),
    // A spent `jti` is needed only until its token expires (a minute and a half at most).
    every(3600_000, 'handoff replay cache', () => purgeReplayCache(pool)),
  ];
  return () => {
    for (const stop of stops) stop();
  };
}
