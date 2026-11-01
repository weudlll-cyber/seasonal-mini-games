/**
 * @file   packages/game-sdk/src/specialSettings.ts
 * @module game-sdk
 * @brief  The platform's keys for the timing of the seasonal specials, in every game document.
 *
 * Responsibility: Heatwave's step and interval, Frost's delay, Leaf Fall's interval and count,
 *                 the halving interval (08 §3): the parts of the specials the platform
 *                 schedules. What a special does to a game's state (which numbers fall, where
 *                 a window sits, a hint's type and when falls stop) belongs to the game. The
 *                 Heatwave floor of 3 s is the owner's and no setting (03 §2.2).
 * Depends on:     ./settings
 * Used by:        ./roundSettings, ./index
 * Spec:           docs/spec/08-admin-settings.md §3; docs/spec/03-seasonal-specials.md §2, §4
 */
import type { SettingDef, SettingValue } from './settings.js';

const admin = {
  editPermission: 'settings.game.edit',
  hostChooses: false,
  running: 'frozen',
  status: 'owner',
  decision: 'O15',
  spec: '08 §3',
} as const;

// [default, min, max] in seconds.
const seconds = (
  key: string,
  label: string,
  help: string,
  [d, min, max]: readonly [number, number, number],
): SettingDef => ({
  key,
  kind: 'int',
  label,
  help,
  default: d,
  min,
  max,
  unit: 's',
  ...admin,
});

export const SPECIAL_SETTINGS: readonly SettingDef[] = [
  seconds(
    'summer.stepS',
    'Heatwave step',
    'How much the cooldown shrinks at each step.',
    [1, 1, 10],
  ),
  seconds(
    'summer.stepIntervalS',
    'Heatwave interval',
    'Time between two Heatwave steps.',
    [30, 5, 300],
  ),
  seconds(
    'autumn.intervalS',
    'Leaf Fall interval',
    'Time between two falls of numbers.',
    [20, 5, 120],
  ),
  {
    key: 'autumn.count',
    kind: 'int',
    label: 'Leaf Fall count',
    help: 'How many numbers fall each time.',
    default: 10,
    min: 1,
    max: 100,
    unit: '',
    ...admin,
  },
  seconds('winter.delayS', 'Frost delay', 'How long every answer takes to arrive.', [3, 1, 10]),
  seconds(
    'halving.intervalS',
    'Halving interval',
    'Time between two halvings of the range.',
    [60, 15, 600],
  ),
];

// The owner's floor: Heatwave never takes the cooldown below 3 s (03 §2.2).
export const HEATWAVE_FLOOR_MS = 3_000;

export interface SpecialTiming {
  readonly heatwave: { readonly stepMs: number; readonly intervalMs: number };
  readonly frostDelayMs: number;
  readonly leafFall: { readonly intervalMs: number; readonly count: number };
  readonly halvingIntervalMs: number;
}

export function readSpecialTiming(values: Readonly<Record<string, SettingValue>>): SpecialTiming {
  const s = (key: string) => (values[key] as number) * 1_000;
  return {
    heatwave: { stepMs: s('summer.stepS'), intervalMs: s('summer.stepIntervalS') },
    frostDelayMs: s('winter.delayS'),
    leafFall: { intervalMs: s('autumn.intervalS'), count: values['autumn.count'] as number },
    halvingIntervalMs: s('halving.intervalS'),
  };
}
