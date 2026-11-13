/**
 * @file   games/mind-games/src/settings.test.ts
 * @module games/mind-games
 * @brief  The settings' defaults, the plan, the series and the cross-key rules with their words.
 *
 * Responsibility: the catalogue of 08 §3.4 (keys, defaults, bounds); the defaults 120/30/60
 *                 giving join 60 s, play end 90 s, end 120 s; the join time following the total
 *                 and not following it; the series from the rounds and the pause; each cross-key
 *                 rule's sentence of 02e §3.
 * Depends on:     vitest, ./settings
 * Spec:           docs/spec/09-testing-strategy.md §4.2; docs/spec/08-admin-settings.md §3.4
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG, mindSettings, planOf, seriesOf } from './settings.js';

describe('Mind Games settings (08 §3.4)', () => {
  it('has the catalogue keys with their defaults and bounds', () => {
    const table = mindSettings.defs.map((d) =>
      d.kind === 'int' ? [d.key, d.default, d.min, d.max] : [d.key, d.default],
    );
    expect(table).toEqual([
      ['mind.totalS', 120, 30, 600],
      ['mind.delayS', 30, 5, 120],
      ['mind.joinAuto', true],
      ['mind.joinS', 60, 10, 590],
      ['mind.allOption', false],
      ['mind.switchVisibility', 'perPlayer'],
      ['mind.winnerPlace', 1, 1, 5],
      ['mind.rounds', 6, 1, 20],
      ['mind.pauseS', 15, 5, 120],
    ]);
    expect(mindSettings.defs.every((d) => d.hostChooses && d.running === 'frozen')).toBe(true);
  });

  it('plans the defaults as join 60 s, play end 90 s, end 120 s, delay 30 s', () => {
    expect(planOf(DEFAULT_CONFIG)).toEqual({
      entryEndMs: 60_000,
      actionsEndMs: 90_000,
      endMs: 120_000,
      viewDelayMs: 30_000,
    });
    expect(seriesOf(DEFAULT_CONFIG)).toEqual({ rounds: 6, pauseMs: 15_000 });
  });
});

describe('Mind Games plan and rules (02e §3, §4)', () => {
  it('lets the join time follow the total, rounded down, unless the host sets it', () => {
    expect(planOf({ ...DEFAULT_CONFIG, totalS: 61, delayS: 10 }).entryEndMs).toBe(30_000);
    expect(planOf({ ...DEFAULT_CONFIG, joinS: 45 }).entryEndMs).toBe(60_000);
    expect(planOf({ ...DEFAULT_CONFIG, joinAuto: false, joinS: 45 }).entryEndMs).toBe(45_000);
  });

  it('words each cross-key rule (02e §3)', () => {
    const problem = (c: Partial<typeof DEFAULT_CONFIG>) =>
      mindSettings.problem({ ...DEFAULT_CONFIG, ...c });
    expect(problem({})).toBeNull();
    expect(problem({ totalS: 70, delayS: 30 })).toBeNull();
    expect(problem({ totalS: 69, delayS: 30 })).toEqual({
      key: 'mind.delayS',
      message: 'The delay must be at most half the total minus 10 s.',
    });
    expect(problem({ joinAuto: false, joinS: 90 })).toBeNull();
    expect(problem({ joinAuto: false, joinS: 91 })).toEqual({
      key: 'mind.joinS',
      message: 'The join time must end by the time choices close (total − delay).',
    });
    // While the join time follows the total, the field's own value is not used.
    expect(problem({ joinS: 590 })).toBeNull();
    expect(problem({ winnerPlace: 5 })).toEqual({
      key: 'mind.winnerPlace',
      message: 'The 5th least chosen needs the All option.',
    });
    expect(problem({ winnerPlace: 5, allOption: true })).toBeNull();
  });

  it('reads frozen values into the config', () => {
    const values = Object.fromEntries(mindSettings.defs.map((d) => [d.key, d.default]));
    expect(mindSettings.read({ ...values, 'mind.switchVisibility': 'hidden' })).toEqual({
      ...DEFAULT_CONFIG,
      switchVisibility: 'hidden',
    });
  });
});
