/**
 * @file   apps/server/src/match/series.ts
 * @module server/match
 * @brief  A match that is a series of rounds: the next round after the pause, then the close.
 *
 * Responsibility: 04 §4.8 rule 7. A match is a series when its first round's game config
 *                 names one (the game's `series` hook). After each of its rounds ends, a
 *                 restart-safe `match_autostart` action is due at the end plus the pause: the
 *                 next round, made from the host's saved next-round settings (the last round's
 *                 until the host changes them) and started at once, without the minimum of
 *                 players; or, after the last round, the match's close with its summary
 *                 (reason `complete`). An action runs once: the scheduler and the host's Start
 *                 next round now both claim it first. An aborted round schedules nothing; the
 *                 host starts the next by hand and the series goes on from there (T297). A start
 *                 schedules what a restart missed (`sweep`).
 * Depends on:     ../db/pool, ../round/* (types), ./matches, ./play (types)
 * Used by:        ../round/runtime, ../http/routes/series
 * Spec:           docs/spec/04-software-architecture.md §4.8 rule 7; docs/spec/06-data-model-api-realtime.md §2.1, §2.5, §3.1
 */
import type { Season } from '@smg/game-sdk';

import type { DbPool } from '../db/pool.js';
import type { LiveRound } from '../round/liveRound.js';
import { matchById, type MatchRow } from './matches.js';
import type { Play } from './play.js';

export interface NextSettings {
  readonly choices: Readonly<Record<string, unknown>>;
  readonly season: Season | null;
}

export interface SeriesState {
  readonly rounds: number;
  readonly played: number;
  // When the pause ends (server time), or null outside a pause.
  readonly nextAt: number | null;
}

interface Due {
  readonly matchId: string;
  readonly close: boolean;
}

// The host's settings for the next round of a series (matches.next_settings).
export async function rememberNext(
  pool: DbPool,
  matchId: string,
  next: NextSettings,
): Promise<void> {
  await pool.query('UPDATE smg.matches SET next_settings = $2 WHERE id = $1', [matchId, next]);
}

export class SeriesRunner {
  constructor(
    private readonly pool: DbPool,
    private readonly play: Play,
  ) {}

  // The match's series from its first round's config, or null when it is none.
  async seriesOf(match: MatchRow) {
    const r = await this.pool.query<{ game: unknown }>(
      `SELECT settings->'game' AS game FROM smg.rounds WHERE match_id = $1
       ORDER BY round_index LIMIT 1`,
      [match.id],
    );
    const first = r.rows[0];
    return first === undefined ? null : this.play.rounds.series(match.gameId, first.game);
  }

  async state(match: MatchRow): Promise<SeriesState | null> {
    const series = await this.seriesOf(match);
    if (series === null) return null;
    const r = await this.pool.query<{ played: string; next_at: Date | null }>(
      `SELECT (SELECT count(*) FROM smg.rounds WHERE match_id = $1 AND status = 'ended') AS played,
              (SELECT min(due_at) FROM smg.scheduled_actions
               WHERE kind = 'match_autostart' AND done_at IS NULL AND payload->>'matchId' = $1::text) AS next_at`,
      [match.id],
    );
    const row = r.rows[0];
    return {
      rounds: series.rounds,
      played: Number(row?.played ?? 0),
      nextAt: row?.next_at?.getTime() ?? null,
    };
  }

  // A round of a phased game ended: the next round or the close is due after the pause.
  async roundEnded(round: LiveRound): Promise<void> {
    if (!round.phased || round.status() !== 'ended') return;
    const match = await matchById(this.pool, round.matchId);
    if (match === null || match.status === 'closed' || match.status === 'aborted') return;
    const series = await this.seriesOf(match);
    if (series === null) return;
    const state = await this.state(match);
    const close = (state?.played ?? 0) >= series.rounds;
    await this.pool.query(
      `INSERT INTO smg.scheduled_actions (round_id, kind, payload, due_at)
       SELECT r.id, 'match_autostart', $2, r.ended_at + make_interval(secs => $3::float8 / 1000)
       FROM smg.rounds r WHERE r.id = $1 AND r.ended_at IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM smg.scheduled_actions a WHERE a.round_id = r.id AND a.kind = 'match_autostart')`,
      [round.id, { matchId: match.id, close } satisfies Due, series.pauseMs],
    );
    this.play.changed(match.id);
  }

  // The scheduler's due action: runs only if nothing ran it before (the host's click).
  async due(actionId: string): Promise<void> {
    const claimed = await this.pool.query<{ payload: Due }>(
      `UPDATE smg.scheduled_actions SET done_at = now() WHERE id = $1 AND done_at IS NULL
       RETURNING payload`,
      [actionId],
    );
    const payload = claimed.rows[0]?.payload;
    if (payload !== undefined) await this.fire(payload);
  }

  // The host's Start next round now: the pending action of the match, at once.
  async startNow(match: MatchRow): Promise<'started' | 'notASeries' | 'notInPause'> {
    if ((await this.seriesOf(match)) === null) return 'notASeries';
    const claimed = await this.pool.query<{ payload: Due }>(
      `UPDATE smg.scheduled_actions SET done_at = now()
       WHERE kind = 'match_autostart' AND done_at IS NULL AND payload->>'matchId' = $1::text
       RETURNING payload`,
      [match.id],
    );
    const payload = claimed.rows[0]?.payload;
    if (payload === undefined) return 'notInPause';
    await this.fire(payload);
    return 'started';
  }

  // Start-up: the last ended round of every open series match whose next step was not written.
  async sweep(): Promise<void> {
    const r = await this.pool.query<{ id: string }>(
      `SELECT r.id::text FROM smg.rounds r JOIN smg.matches m ON m.id = r.match_id
       WHERE m.status IN ('lobby', 'open') AND r.status = 'ended'
         AND r.round_index = (SELECT max(x.round_index) FROM smg.rounds x WHERE x.match_id = r.match_id)
         AND NOT EXISTS (SELECT 1 FROM smg.scheduled_actions a
                         WHERE a.round_id = r.id AND a.kind = 'match_autostart')`,
    );
    for (const row of r.rows) {
      const round = await this.play.rounds.get(row.id);
      if (round !== null) await this.roundEnded(round);
    }
  }

  private async fire(due: Due): Promise<void> {
    const match = await matchById(this.pool, due.matchId);
    if (match === null || match.status === 'closed' || match.status === 'aborted') return;
    if (due.close) {
      await this.play.close(match, { status: 'closed', reason: 'complete', by: 'system' });
      return;
    }
    if (match.hostId === null || (await this.play.runningRound(match)) !== null) return;
    const r = await this.pool.query<{ next: NextSettings | null }>(
      'SELECT next_settings AS next FROM smg.matches WHERE id = $1',
      [match.id],
    );
    const next = r.rows[0]?.next ?? { choices: {}, season: null };
    const round = await this.play.createRound(match, match.hostId, {
      choices: next.choices,
      season: next.season ?? undefined,
    });
    await this.play.startRound(match, round, undefined, true);
  }
}
