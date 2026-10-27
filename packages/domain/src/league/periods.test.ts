/**
 * @file   packages/domain/src/league/periods.test.ts
 * @module domain/league
 * @brief  The season board's quarter and name.
 *
 * Responsibility: a moment falls in its UTC calendar quarter, the bounds are the quarter's
 *                 first instants, the last millisecond of a quarter still belongs to it, and
 *                 the name follows the configured first season through the year.
 * Depends on:     vitest, ./periods
 * Spec:           docs/spec/02-game-guess-the-number.md §9; Bingo 01 §10
 */
import { describe, expect, it } from 'vitest';

import { quarterPeriod } from './periods.js';

describe('quarterPeriod', () => {
  it('names the four quarters of a year after the first quarter season', () => {
    const names = [0, 3, 6, 9].map((m) => quarterPeriod(Date.UTC(2027, m, 15), 'winter').name);
    expect(names).toEqual(['Winter 2027', 'Spring 2027', 'Summer 2027', 'Autumn 2027']);
    expect(quarterPeriod(Date.UTC(2027, 0, 15), 'spring').name).toBe('Spring 2027');
    expect(quarterPeriod(Date.UTC(2027, 9, 15), 'spring').name).toBe('Winter 2027');
  });

  it('bounds a quarter by its first instants in UTC', () => {
    const p = quarterPeriod(Date.UTC(2026, 9, 27, 1, 2, 3), 'winter');
    expect(p.startsAt).toBe(Date.UTC(2026, 9, 1));
    expect(p.endsAt).toBe(Date.UTC(2027, 0, 1));
    const last = quarterPeriod(Date.UTC(2026, 11, 31, 23, 59, 59, 999), 'winter');
    expect(last.startsAt).toBe(p.startsAt);
    expect(quarterPeriod(Date.UTC(2027, 0, 1), 'winter').name).toBe('Winter 2027');
  });
});
