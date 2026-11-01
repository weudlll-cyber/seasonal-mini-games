/**
 * @file   packages/domain/src/league/periods.ts
 * @module domain/league
 * @brief  The season board's period: the meteorological season of a moment, and its name.
 *
 * Responsibility: a season board covers one meteorological season in UTC (owner decision
 *                 O30; UTC so a period has the same bounds for every viewer): spring March to
 *                 May, summer June to August, autumn September to November, winter December
 *                 to February. Its name is the season and the year, e.g. "Spring 2027"; a
 *                 winter runs across the year change and names both years, "Winter 2026/27"
 *                 (DECISIONS T107).
 * Depends on:     @smg/game-sdk (Season)
 * Used by:        ../index, apps/server (league awards)
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/06-data-model-api-realtime.md §2.6
 */
import type { Season } from '@smg/game-sdk';

// The seasons in the order of their first month, from December (month 11) on.
const BY_START: readonly Season[] = ['winter', 'spring', 'summer', 'autumn'];

export interface SeasonPeriod {
  readonly season: Season;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly name: string;
}

export function seasonPeriod(at: number): SeasonPeriod {
  const d = new Date(at);
  const month = d.getUTCMonth();
  // December belongs to the winter that ends in the next year; January and February to the
  // one that began in the year before. Months counted from that December: 0 to 11.
  const startYear = month === 11 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  const sinceDecember = (month + 1) % 12;
  const index = Math.floor(sinceDecember / 3);
  const season = BY_START[index] ?? 'winter';
  // Date.UTC rolls month 12 and above over into the next year.
  const startMonth = 11 + index * 3;
  const year = startYear + (index === 0 ? 0 : 1);
  const short = String((startYear + 1) % 100).padStart(2, '0');
  return {
    season,
    startsAt: Date.UTC(startYear, startMonth, 1),
    endsAt: Date.UTC(startYear, startMonth + 3, 1),
    name:
      season === 'winter'
        ? `Winter ${String(startYear)}/${short}`
        : `${season.charAt(0).toUpperCase()}${season.slice(1)} ${String(year)}`,
  };
}
