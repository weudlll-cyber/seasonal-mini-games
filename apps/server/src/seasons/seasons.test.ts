/**
 * @file   apps/server/src/seasons/seasons.test.ts
 * @module server/seasons
 * @brief  The In Season feed's polling never stops on a failure.
 *
 * Responsibility: `Seasons.start` polls at once and then every `inSeason.pollS`; when the
 *                 settings cannot be read (the database away), the loop goes on at the
 *                 setting's default (300 s) instead of ending; `stop` ends it. Fake settings
 *                 without a feed (nothing is fetched, no pool), fake timers.
 * Depends on:     vitest, @smg/application (types), ../db/pool (types), ./seasons
 * Spec:           docs/spec/07-integration.md §5; docs/spec/08-admin-settings.md §4
 */
import type { SettingsService } from '@smg/application';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DbPool } from '../db/pool.js';
import { Seasons } from './seasons.js';

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the season feed poll', () => {
  it('goes on at the default when the settings cannot be read, until stopped', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const values = vi.fn(() =>
      Promise.resolve({ 'seasons.feedUrl': '', 'inSeason.pollS': 60 } as Record<string, unknown>),
    );
    // The first tick's two reads fail (its poll and its wait).
    values.mockRejectedValueOnce(new Error('database away'));
    values.mockRejectedValueOnce(new Error('database away'));
    const settings = { values } as unknown as SettingsService;
    const seasons = new Seasons(undefined as unknown as DbPool, settings, null);
    seasons.start();
    await vi.advanceTimersByTimeAsync(1);
    expect(values).toHaveBeenCalledTimes(2);
    // Not after the setting's 60 s: it was not read, so the default 300 s applies.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(values).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(240_000);
    expect(values).toHaveBeenCalledTimes(4);
    // From now on every 60 s, as the setting says.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(values).toHaveBeenCalledTimes(6);
    seasons.stop();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(values).toHaveBeenCalledTimes(6);
  });
});
