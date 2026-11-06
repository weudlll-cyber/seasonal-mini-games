/**
 * @file   packages/game-sdk/src/roundSettings.test.ts
 * @module game-sdk
 * @brief  The platform round keys: catalogue defaults and their conversion to milliseconds.
 *
 * Responsibility: every key's default fits its own definition, and the defaults read as
 *                 the round config of 02 §3 and 02 §9 (10 s cooldown, 5 s countdown,
 *                 10 min, 2 s margin window, points 10 / 10-7-5-3 / 1, proof on); the
 *                 inactivity limit takes 0 (off) or 20–600 s and the warning only below it
 *                 (O71).
 * Depends on:     vitest, ./roundSettings, ./settings
 * Spec:           docs/spec/08-admin-settings.md §3
 */
import { describe, expect, it } from 'vitest';

import { inactivityIssue, PLATFORM_ROUND_SETTINGS, readPlatformRound } from './roundSettings.js';
import { resolveSettings, settingProblem } from './settings.js';

describe('platform round settings', () => {
  it('have defaults inside their own bounds', () => {
    for (const def of PLATFORM_ROUND_SETTINGS) {
      expect(settingProblem(def, def.default), def.key).toBeNull();
    }
  });

  it('read the defaults as the round config of the spec', () => {
    const config = readPlatformRound(resolveSettings(PLATFORM_ROUND_SETTINGS, {}));
    expect(config).toEqual({
      secretMode: 'shared',
      cooldownMs: 10_000,
      // Out after 60 s without a guess, warned after 30 s (O71).
      inactivityLimitMs: 60_000,
      inactivityWarnMs: 30_000,
      countdownMs: 10_000,
      maxDurationMs: 600_000,
      marginWindowMs: 2_000,
      specialOn: true,
      teamsOn: true,
      halving: false,
      commitReveal: true,
      points: { sharedWinner: 10, individualPlaces: [10, 7, 5, 3], individualOtherSolver: 1 },
      specials: {
        // Heatwave: 1 s shorter every 10 s (O57).
        heatwave: { stepMs: 1_000, intervalMs: 10_000 },
        frostDelayMs: 3_000,
        leafFall: { intervalMs: 20_000, count: 10 },
        halvingIntervalMs: 60_000,
      },
    });
  });

  it('take the inactivity limit 0 (off) or 20–600 s and the warning below it (O71)', () => {
    const def = (key: string) => PLATFORM_ROUND_SETTINGS.find((d) => d.key === key);
    const limit = def('round.inactivityLimitS');
    if (limit === undefined) throw new Error('the limit is defined');
    for (const ok of [0, 20, 600]) expect(settingProblem(limit, ok), String(ok)).toBeNull();
    for (const bad of [1, 19, 601]) expect(settingProblem(limit, bad), String(bad)).not.toBeNull();
    const pair = (l: number, w: number) =>
      inactivityIssue({ 'round.inactivityLimitS': l, 'round.inactivityWarnS': w });
    expect(pair(60, 30)).toBeNull();
    expect(pair(0, 590)).toBeNull();
    // The warning field's issue in the words every form shows (O74).
    expect(pair(60, 60)).toEqual({
      key: 'round.inactivityWarnS',
      message: 'The warning must be shorter than the limit.',
    });
    expect(pair(20, 25)).not.toBeNull();
  });
});
