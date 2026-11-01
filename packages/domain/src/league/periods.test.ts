/**
 * @file   packages/domain/src/league/periods.test.ts
 * @module domain/league
 * @brief  The season board's meteorological season and its name.
 *
 * Responsibility: every month falls in its meteorological season (O30), the bounds are the
 *                 seasons' first instants in UTC, the last millisecond of a season still
 *                 belongs to it, and a winter across the year change is one period named
 *                 after both years (T107).
 * Depends on:     vitest, ./periods
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/06-data-model-api-realtime.md §2.6
 */
import { describe, expect, it } from 'vitest';

import { seasonPeriod } from './periods.js';

describe('seasonPeriod', () => {
  it('puts every month of 2027 in its meteorological season', () => {
    const names = Array.from({ length: 12 }, (_, m) => seasonPeriod(Date.UTC(2027, m, 15)).name);
    expect(names).toEqual([
      'Winter 2026/27',
      'Winter 2026/27',
      'Spring 2027',
      'Spring 2027',
      'Spring 2027',
      'Summer 2027',
      'Summer 2027',
      'Summer 2027',
      'Autumn 2027',
      'Autumn 2027',
      'Autumn 2027',
      'Winter 2027/28',
    ]);
  });

  it('bounds a season by its first instants in UTC', () => {
    const autumn = seasonPeriod(Date.UTC(2026, 9, 27, 1, 2, 3));
    expect(autumn).toEqual({
      season: 'autumn',
      startsAt: Date.UTC(2026, 8, 1),
      endsAt: Date.UTC(2026, 11, 1),
      name: 'Autumn 2026',
    });
    expect(seasonPeriod(Date.UTC(2026, 10, 30, 23, 59, 59, 999)).startsAt).toBe(autumn.startsAt);
    expect(seasonPeriod(autumn.endsAt).season).toBe('winter');
  });

  it('keeps one winter across the year change, December to February', () => {
    const december = seasonPeriod(Date.UTC(2026, 11, 1));
    const february = seasonPeriod(Date.UTC(2027, 1, 28, 23, 59, 59, 999));
    expect(december).toEqual({
      season: 'winter',
      startsAt: Date.UTC(2026, 11, 1),
      endsAt: Date.UTC(2027, 2, 1),
      name: 'Winter 2026/27',
    });
    expect(february).toEqual(december);
    // A leap year's 29 February is still winter; 1 March is spring.
    expect(seasonPeriod(Date.UTC(2028, 1, 29)).name).toBe('Winter 2027/28');
    expect(seasonPeriod(Date.UTC(2028, 2, 1)).name).toBe('Spring 2028');
    expect(seasonPeriod(Date.UTC(2099, 11, 31)).name).toBe('Winter 2099/00');
  });
});
