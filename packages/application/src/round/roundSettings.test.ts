/**
 * @file   packages/application/src/round/roundSettings.test.ts
 * @module application/round
 * @brief  A round's settings from the host's choices inside the admin's bounds.
 *
 * Responsibility: host choices are taken only for host keys inside their bounds; the game's own
 *                 rule across keys is said for the form or under the setting it names (T335);
 *                 Heatwave's step and interval per round (O63); the inactivity limit and its
 *                 warning below it (O71, O74); a phased round's hold before the result (its
 *                 default, bounds, the time-up it freezes, none for a guess game, T384). Split
 *                 from ./roundSession.test by responsibility.
 * Depends on:     vitest, ./fakes, ./roundSettings
 * Spec:           docs/spec/02-game-guess-the-number.md §3; docs/spec/08-admin-settings.md §3, §3.4
 */
import { describe, expect, it } from 'vitest';

import { findGame, pickGame } from './fakes.js';
import { chooseRoundSettings, gameSettingsDefs } from './roundSettings.js';

describe('round settings', () => {
  it('take host choices inside the bounds and refuse everything else', () => {
    expect(gameSettingsDefs(findGame).at(-1)?.key).toBe('find.max');
    const chosen = chooseRoundSettings(
      findGame,
      { 'round.cooldownS': { max: 20 } },
      { 'round.cooldownS': 15 },
    );
    expect(chosen.platform.cooldownMs).toBe(15_000);
    expect(chosen.game).toEqual({ max: 10 });
    const refused = [
      [{ 'round.cooldownS': { max: 20 } }, { 'round.cooldownS': 25 }],
      [{}, { 'points.sharedWinner': 5 }],
      [{}, { nope: 1 }],
      [{}, { 'find.max': 13 }],
    ] as const;
    for (const [overrides, choices] of refused) {
      expect(() => chooseRoundSettings(findGame, overrides, choices)).toThrow(
        expect.objectContaining({ code: 'ROUND_SETTINGS_INVALID' }),
      );
    }
  });

  it('say a rule across keys for the form, or under the setting it names (T335)', () => {
    expect(() => chooseRoundSettings(findGame, {}, { 'find.max': 13 })).toThrow(
      expect.objectContaining({ message: 'Thirteen is unlucky.', field: null }),
    );
    const named = {
      ...findGame,
      settings: {
        ...findGame.settings,
        problem: () => ({ key: 'find.max', message: 'Too high.' }),
      },
    };
    expect(() => chooseRoundSettings(named, {}, {})).toThrow(
      expect.objectContaining({ message: 'Too high.', field: 'find.max' }),
    );
  });
});

describe("Heatwave's numbers per round (O63)", () => {
  it("use the host's step and interval over the admin's defaults, inside the bounds", () => {
    const defaults = chooseRoundSettings(findGame, {}, {});
    expect(defaults.platform.specials.heatwave).toEqual({ stepMs: 1_000, intervalMs: 10_000 });
    const chosen = chooseRoundSettings(
      findGame,
      { 'summer.stepIntervalS': { value: 30 } },
      { 'summer.stepS': 4, 'summer.stepIntervalS': 20 },
    );
    expect(chosen.platform.specials.heatwave).toEqual({ stepMs: 4_000, intervalMs: 20_000 });
    for (const choices of [{ 'summer.stepS': 11 }, { 'summer.stepIntervalS': 4 }]) {
      expect(() => chooseRoundSettings(findGame, {}, choices)).toThrow(
        expect.objectContaining({ code: 'ROUND_SETTINGS_INVALID' }),
      );
    }
  });
});

describe('the inactivity limit per round (O71)', () => {
  it("takes the host's limit and warning over the admin's defaults, and 0 as off", () => {
    const defaults = chooseRoundSettings(findGame, {}, {}).platform;
    expect([defaults.inactivityLimitMs, defaults.inactivityWarnMs]).toEqual([60_000, 30_000]);
    const chosen = chooseRoundSettings(
      findGame,
      { 'round.inactivityLimitS': { value: 120 } },
      { 'round.inactivityWarnS': 90 },
    ).platform;
    expect([chosen.inactivityLimitMs, chosen.inactivityWarnMs]).toEqual([120_000, 90_000]);
    const off = chooseRoundSettings(findGame, {}, { 'round.inactivityLimitS': 0 }).platform;
    expect(off.inactivityLimitMs).toBe(0);
  });

  it('refuses a warning not below the limit, also against the admin default', () => {
    const pair = 'The warning must be shorter than the limit.';
    const range = 'Must be between 20 and 600, or 0 for off.';
    // Each refusal names the field it belongs to, with its sentence (O74).
    const refused = [
      [{}, { 'round.inactivityLimitS': 30, 'round.inactivityWarnS': 30 }, 'Warn', pair],
      [{}, { 'round.inactivityLimitS': 25 }, 'Warn', pair],
      [{ 'round.inactivityWarnS': { value: 50 } }, { 'round.inactivityLimitS': 40 }, 'Warn', pair],
      [{}, { 'round.inactivityLimitS': 10 }, 'Limit', range],
    ] as const;
    for (const [overrides, choices, field, message] of refused) {
      expect(() => chooseRoundSettings(findGame, overrides, choices)).toThrow(
        expect.objectContaining({
          code: 'ROUND_SETTINGS_INVALID',
          field: `round.inactivity${field}S`,
          message,
        }),
      );
    }
  });
});

describe("a phased round's hold before the result (T384)", () => {
  const HOLD = 'round.resultHoldS';
  // pickGame's plan ends at 10 s.
  const timeUp = (choices: Readonly<Record<string, unknown>>, admin = {}) =>
    chooseRoundSettings(pickGame, admin, choices).platform.maxDurationMs;

  it('is a host setting of a phased game only, 5 s by default, from 1 to 20 s', () => {
    const def = gameSettingsDefs(pickGame).find((d) => d.key === HOLD);
    expect(def).toMatchObject({
      default: 5,
      min: 1,
      max: 20,
      hostChooses: true,
      running: 'frozen',
    });
    expect(gameSettingsDefs(findGame).some((d) => d.key === HOLD)).toBe(false);
    expect(() => chooseRoundSettings(findGame, {}, { [HOLD]: 5 })).toThrow(/not a setting/);
  });

  it('puts the time-up the hold after the plan’s end, frozen per round', () => {
    expect(timeUp({})).toBe(15_000);
    expect(timeUp({ [HOLD]: 1 })).toBe(11_000);
    expect(timeUp({ [HOLD]: 20 })).toBe(30_000);
    // The admin's default for the game's rounds, the host's choice over it.
    expect(timeUp({}, { [HOLD]: { value: 8 } })).toBe(18_000);
    expect(timeUp({ [HOLD]: 2 }, { [HOLD]: { value: 8 } })).toBe(12_000);
  });

  it('refuses a hold outside its bounds or in parts of a second', () => {
    for (const bad of [0, 21, 2.5]) {
      expect(() => chooseRoundSettings(pickGame, {}, { [HOLD]: bad })).toThrow(
        expect.objectContaining({ code: 'ROUND_SETTINGS_INVALID', field: HOLD }),
      );
    }
  });
});
