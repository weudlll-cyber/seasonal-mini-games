/**
 * @file   packages/game-sdk/src/roundSettings.test.ts
 * @module game-sdk
 * @brief  The platform round keys: catalogue defaults and their conversion to milliseconds.
 *
 * Responsibility: every key's default fits its own definition, and the defaults read as
 *                 the round config of 02 §3 and 02 §9 (10 s cooldown, 5 s countdown,
 *                 10 min, 2 s margin window, points 10 / 10-7-5-3 / 1, proof on).
 * Depends on:     vitest, ./roundSettings, ./settings
 * Spec:           docs/spec/08-admin-settings.md §3
 */
import { describe, expect, it } from 'vitest';

import { PLATFORM_ROUND_SETTINGS, readPlatformRound } from './roundSettings.js';
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
      countdownMs: 5_000,
      maxDurationMs: 600_000,
      marginWindowMs: 2_000,
      specialOn: true,
      teamsOn: true,
      halving: false,
      commitReveal: true,
      points: { sharedWinner: 10, individualPlaces: [10, 7, 5, 3], individualOtherSolver: 1 },
      specials: {
        heatwave: { stepMs: 1_000, intervalMs: 30_000 },
        frostDelayMs: 3_000,
        leafFall: { intervalMs: 20_000, count: 10 },
        halvingIntervalMs: 60_000,
      },
    });
  });
});
