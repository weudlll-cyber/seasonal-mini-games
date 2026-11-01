/**
 * @file   apps/server/src/seasons/seasons.ts
 * @module server/seasons
 * @brief  In Season and the halving days: the feed poller, the current season, today's halving.
 *
 * Responsibility: poll `seasons.feedUrl` every `inSeason.pollS` (07 §5; a development build
 *                 may name a local feed instead, SMG_DEV_FEED_URL); a valid answer
 *                 replaces the stored one and merges its halving days (admin entries stay),
 *                 an invalid or missing one keeps the last good answer and records the error.
 *                 The current season is usable only while younger than `inSeason.staleAfterH`
 *                 (03 §3). Today is a halving day when `halving_days` lists the date of today
 *                 in `halving.timeZone` (03 §4). Unknown fields of the feed are ignored.
 * Depends on:     zod, @smg/application (settings), ../db/pool, ./safeFetch
 * Used by:        ../round/runtime, ../match/play, ../http/routes/seasons
 * Spec:           docs/spec/03-seasonal-specials.md §3, §4; docs/spec/07-integration.md §5
 */
import type { SettingsService } from '@smg/application';
import type { Season } from '@smg/game-sdk';
import { z } from 'zod';

import type { DbPool } from '../db/pool.js';
import { safeFetchJson } from './safeFetch.js';

const SEASON = z.enum(['spring', 'summer', 'autumn', 'winter']);
const feedSchema = z.object({
  v: z.literal(1),
  inSeason: z.object({ season: SEASON, token: z.string().min(1).max(40), since: z.iso.datetime() }),
  halvingDays: z
    .array(z.object({ day: z.iso.date(), token: z.string().min(1).max(40) }))
    .max(200)
    .optional(),
});

export interface InSeason {
  readonly season: Season;
  readonly token: string;
  readonly since: number;
  readonly fetchedAt: number;
}

export interface FeedState {
  readonly inSeason: InSeason | null;
  readonly fetchedAt: number | null;
  readonly lastError: string | null;
}

// The calendar date of `now` in a time zone, as YYYY-MM-DD; an unknown zone counts as UTC.
export function dayIn(now: number, timeZone: string): string {
  const format = (zone: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  try {
    return format(timeZone);
  } catch {
    return format('UTC');
  }
}

export class Seasons {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly pool: DbPool,
    private readonly settings: SettingsService,
    // Development only: a local feed that replaces the setting, plain HTTP allowed.
    private readonly devFeedUrl: string | null,
  ) {}

  start(): void {
    const tick = (): void => {
      void this.poll()
        .catch((error: unknown) => {
          console.error('[smg] season feed poll failed:', error);
        })
        .then(() => this.settings.values('seasons'))
        .then((v) => {
          if (this.timer !== null)
            this.timer = setTimeout(tick, (v['inSeason.pollS'] as number) * 1_000);
        });
    };
    this.timer = setTimeout(tick, 0);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  // One poll now; with no feed configured, nothing happens.
  async poll(): Promise<{ readonly ok: boolean; readonly error?: string }> {
    const url =
      this.devFeedUrl ?? ((await this.settings.values('seasons'))['seasons.feedUrl'] as string);
    if (url === '') return { ok: false, error: 'no feed configured' };
    try {
      const fetched = await safeFetchJson(url, { allowLocal: this.devFeedUrl !== null });
      const feed = feedSchema.parse(fetched);
      await this.keep(feed);
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof z.ZodError
          ? 'the feed answer has the wrong shape'
          : (error as Error).message;
      await this.pool.query('UPDATE smg.season_feed_state SET last_error = $1 WHERE id = 1', [
        message.slice(0, 200),
      ]);
      return { ok: false, error: message };
    }
  }

  private async keep(feed: z.infer<typeof feedSchema>): Promise<void> {
    const s = feed.inSeason;
    await this.pool.query(
      `UPDATE smg.season_feed_state SET season = $1, token = $2, since = $3, fetched_at = now(),
         last_error = NULL WHERE id = 1`,
      [s.season, s.token, s.since],
    );
    for (const d of feed.halvingDays ?? []) {
      // Admin entries are never overwritten by the feed (07 §5).
      await this.pool.query(
        `INSERT INTO smg.halving_days (day, token, source) VALUES ($1, $2, 'feed') ON CONFLICT DO NOTHING`,
        [d.day, d.token],
      );
    }
  }

  async feedState(): Promise<FeedState> {
    const r = await this.pool.query<{
      season: Season | null;
      token: string | null;
      since: Date | null;
      fetched_at: Date | null;
      last_error: string | null;
    }>(
      'SELECT season, token, since, fetched_at, last_error FROM smg.season_feed_state WHERE id = 1',
    );
    const row = r.rows[0];
    const fetchedAt = row?.fetched_at?.getTime() ?? null;
    const inSeason =
      row?.season == null || row.token === null || fetchedAt === null
        ? null
        : {
            season: row.season,
            token: row.token,
            since: row.since?.getTime() ?? fetchedAt,
            fetchedAt,
          };
    return { inSeason, fetchedAt, lastError: row?.last_error ?? null };
  }

  // The In Season answer if it is fresh enough to use (03 §3), else null.
  async inSeason(now = Date.now()): Promise<InSeason | null> {
    const [state, values] = await Promise.all([this.feedState(), this.settings.values('seasons')]);
    const staleMs = (values['inSeason.staleAfterH'] as number) * 3_600_000;
    return state.inSeason !== null && now - state.inSeason.fetchedAt <= staleMs
      ? state.inSeason
      : null;
  }

  async halvingToday(
    now = Date.now(),
  ): Promise<{ readonly day: string; readonly tokens: string[] } | null> {
    const zone = (await this.settings.values('seasons'))['halving.timeZone'] as string;
    const day = dayIn(now, zone);
    const r = await this.pool.query<{ token: string }>(
      'SELECT token FROM smg.halving_days WHERE day = $1 ORDER BY token',
      [day],
    );
    return r.rows.length === 0 ? null : { day, tokens: r.rows.map((x) => x.token) };
  }
}
