/**
 * @file   packages/domain/src/league/periods.ts
 * @module domain/league
 * @brief  The season board's period: the calendar quarter of a moment, named after a season.
 *
 * Responsibility: a season board covers one calendar quarter in UTC (Bingo 01 §10; UTC so a
 *                 period has the same bounds for every viewer, DECISIONS T69). Its name is the
 *                 season of that quarter and the year, e.g. "Winter 2027": the first quarter
 *                 is `leaderboard.firstQuarterSeason` (proposal: winter) and the others
 *                 follow in the order of the year (spring, summer, autumn, winter).
 * Depends on:     @smg/game-sdk (Season)
 * Used by:        ../index, apps/server (league awards)
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/08-admin-settings.md §4
 */
import type { Season } from '@smg/game-sdk';

const YEAR: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

export interface QuarterPeriod {
  readonly startsAt: number;
  readonly endsAt: number;
  readonly name: string;
}

export function quarterPeriod(at: number, firstQuarterSeason: Season): QuarterPeriod {
  const d = new Date(at);
  const year = d.getUTCFullYear();
  const quarter = Math.floor(d.getUTCMonth() / 3);
  const season = YEAR[(YEAR.indexOf(firstQuarterSeason) + quarter) % 4] ?? firstQuarterSeason;
  return {
    startsAt: Date.UTC(year, quarter * 3, 1),
    endsAt: Date.UTC(year, quarter * 3 + 3, 1),
    name: `${season.charAt(0).toUpperCase()}${season.slice(1)} ${String(year)}`,
  };
}
