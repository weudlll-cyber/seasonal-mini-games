/**
 * @file   apps/server/src/match/idleClose.ts
 * @module server/match
 * @brief  Closes matches without a round for `match.lobbyIdleCloseMin` minutes (O28).
 *
 * Responsibility: a match in the lobby or open closes itself once no round has run or been
 *                 created for the configured time, measured from the later of the match's
 *                 creation and its last round's creation, end or abort. A round counting
 *                 down or open is never closed. The close is the host's close path with
 *                 `by: 'system'` and the reason `idle`, so a round only set up is aborted
 *                 (reason `idle`) and the ended rounds keep their points. A sweep runs on server start
 *                 (overdue matches close at once after a restart) and then every minute; a
 *                 match that fails to close is left for the next sweep.
 * Depends on:     @smg/application (settings), ./matches, ./play, ../db/pool
 * Used by:        ../round/runtime, ./summary (LAST_ACTIVITY)
 * Spec:           docs/spec/02-game-guess-the-number.md §2; docs/spec/08-admin-settings.md §4
 */
import type { SettingsService } from '@smg/application';

import type { DbPool } from '../db/pool.js';
import { matchById, type MatchEnd } from './matches.js';
import type { Play } from './play.js';

const SWEEP_MS = 60_000;
const IDLE: MatchEnd = { status: 'closed', reason: 'idle', by: 'system' };

// The time of a match's last activity, for a row `m` of smg.matches (O28): its creation, a
// round's creation, or a round's end or abort. The abort of a set-up round by the idle close
// itself (reason `idle`) is not activity, so the summary measures the same span.
export const LAST_ACTIVITY = `greatest(m.created_at, (
    SELECT max(greatest(r.created_at, CASE WHEN r.aborted_reason = 'idle' THEN NULL ELSE r.ended_at END))
    FROM smg.rounds r WHERE r.match_id = m.id))`;

// Matches idle since before `before`, with no round counting down or open.
async function overdue(pool: DbPool, before: number): Promise<string[]> {
  const r = await pool.query<{ id: string }>(
    `SELECT m.id::text FROM smg.matches m
     WHERE m.status IN ('lobby', 'open')
       AND NOT EXISTS (SELECT 1 FROM smg.rounds r
                       WHERE r.match_id = m.id AND r.status IN ('countdown', 'open'))
       AND ${LAST_ACTIVITY} < to_timestamp($1 / 1000.0)`,
    [before],
  );
  return r.rows.map((row) => row.id);
}

export class IdleClose {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly pool: DbPool,
    private readonly play: Play,
    private readonly settings: SettingsService,
    private readonly now: () => number = Date.now,
  ) {}

  // Closes every overdue match; returns how many it closed.
  async sweep(): Promise<number> {
    const values = await this.settings.values('matchmaking');
    const minutes = values['match.lobbyIdleCloseMin'] as number;
    const ids = await overdue(this.pool, this.now() - minutes * 60_000);
    let closed = 0;
    for (const id of ids) {
      // One match that cannot be closed (its round cannot be loaded) must not stop the
      // others or the server's start; the next sweep tries it again.
      if (await this.closeOne(id).catch(() => false)) closed += 1;
    }
    return closed;
  }

  private async closeOne(id: string): Promise<boolean> {
    const match = await matchById(this.pool, id);
    if (match === null) return false;
    // A host may have started a round since the query: never close a running one.
    const running = await this.play.runningRound(match);
    if (running !== null && running.status() !== 'created') return false;
    await this.play.close(match, { ...IDLE, at: this.now() });
    return true;
  }

  start(): void {
    this.timer = setInterval(() => {
      void this.sweep().catch(() => undefined);
    }, SWEEP_MS);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}
