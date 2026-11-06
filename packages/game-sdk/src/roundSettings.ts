/**
 * @file   packages/game-sdk/src/roundSettings.ts
 * @module game-sdk
 * @brief  The platform's round keys that every game's settings document carries.
 *
 * Responsibility: the definitions of 08 §3 that are rules of the platform, not of one game
 *                 (secret mode, cooldown, inactivity limit and warning, countdown, longest
 *                 round, winning margin, season source and toggles, points, fairness proof,
 *                 and the specials' timing from ./specialSettings), how their frozen values
 *                 become the platform's round config in milliseconds, and the one cross-key
 *                 rule (the warning below the limit, O71, as the warning field's issue, O74).
 *                 A game's document is these keys
 *                 followed by the game's own (GameSettings.defs).
 * Depends on:     ./settings, ./module, ./specialSettings
 * Used by:        ./index, packages/domain (round config), packages/application, games/*
 * Spec:           docs/spec/08-admin-settings.md §3, docs/spec/02-game-guess-the-number.md §3, §5.3, §9
 */
import type { SecretMode } from './module.js';
import type { SettingDef, SettingIssue, SettingValue } from './settings.js';
import { readSpecialTiming, SPECIAL_SETTINGS, type SpecialTiming } from './specialSettings.js';

const GAME_ADMIN = 'settings.game.edit';

// Who and when for the two kinds of round keys (08 §2): the host picks per round, or a game
// admin sets it for every round. Both are frozen into a round at creation.
const host = { editPermission: GAME_ADMIN, hostChooses: true, running: 'frozen' } as const;
const admin = { editPermission: GAME_ADMIN, hostChooses: false, running: 'frozen' } as const;
const owner = (decision: string) => ({ status: 'owner', decision, spec: '08 §3' }) as const;

const ROUND_SETTINGS: readonly SettingDef[] = [
  {
    key: 'round.secretMode',
    kind: 'enum',
    label: 'Secret',
    help: 'Shared: everyone searches the same number. Individual: everyone has their own.',
    default: 'shared',
    options: ['shared', 'individual'],
    ...owner('O15'),
    ...host,
  },
  {
    key: 'round.cooldownS',
    kind: 'int',
    label: 'Cooldown',
    help: 'How long a player waits after each accepted guess. The same for everyone.',
    default: 10,
    min: 3,
    max: 60,
    unit: 's',
    ...owner('O3'),
    ...host,
  },
  // The inactivity limit (O71): out of the round after this long without a guess, warned
  // before; 0 switches it off. The warning must come before the limit (inactivityIssue).
  {
    key: 'round.inactivityLimitS',
    kind: 'int',
    label: 'Inactivity limit',
    help: 'A player who makes no guess for this long is out of this round. 0 switches it off.',
    default: 60,
    min: 20,
    max: 600,
    off: 0,
    unit: 's',
    ...owner('O71'),
    ...host,
  },
  {
    key: 'round.inactivityWarnS',
    kind: 'int',
    label: 'Inactivity warning',
    help: 'When the player sees the countdown to the limit. Must be below the limit.',
    default: 30,
    min: 5,
    max: 590,
    unit: 's',
    ...owner('O71'),
    ...host,
  },
  {
    key: 'round.countdownS',
    kind: 'int',
    label: 'Countdown before opening',
    help: 'The intro screen with the season and its special, before the first guess.',
    // Proposal (OPEN (ab)): long enough to read the intro screen (O36); was 5 s.
    default: 10,
    min: 3,
    max: 30,
    unit: 's',
    status: 'proposal',
    spec: '08 §3',
    ...host,
  },
  {
    key: 'round.maxDurationMin',
    kind: 'int',
    label: 'Longest round',
    help: 'The round ends with "time is up" after this long.',
    default: 10,
    min: 1,
    max: 60,
    unit: 'min',
    ...owner('O15'),
    ...host,
  },
  {
    key: 'round.marginWindowS',
    kind: 'number',
    label: 'Winning-margin window',
    help: 'How long after the winning guess a correct guess still counts for the margin.',
    default: 2,
    min: 0.5,
    max: 10,
    step: 0.5,
    unit: 's',
    status: 'owner',
    decision: 'O33',
    spec: '02 §9',
    ...admin,
  },
  {
    key: 'round.seasonSource',
    kind: 'enum',
    label: 'Season',
    help: 'Follow the season of the website (In Season), or pick one by hand.',
    default: 'inSeason',
    options: ['inSeason', 'manual'],
    ...owner('O15'),
    ...host,
  },
  {
    key: 'round.specialOn',
    kind: 'bool',
    label: 'Season special',
    help: "Run the season's special in this round.",
    default: true,
    ...owner('O15'),
    ...host,
  },
  {
    key: 'round.teamsOn',
    kind: 'bool',
    label: 'Season teams',
    help: "Shared mode: the winner's team scores the round.",
    default: true,
    ...owner('O15'),
    ...host,
  },
  {
    key: 'round.halving',
    kind: 'bool',
    label: 'Halving round',
    help: 'Offered only on a halving day.',
    default: false,
    ...owner('O6'),
    ...host,
  },
  {
    key: 'points.sharedWinner',
    kind: 'int',
    label: 'Points for the shared winner',
    help: 'Match points for the winner of a shared round.',
    default: 10,
    min: 0,
    max: 1_000,
    unit: '',
    ...owner('O11'),
    ...admin,
  },
  {
    key: 'points.individualPlaces',
    kind: 'intList',
    label: 'Points for individual places',
    help: 'Match points for places 1, 2, 3 … of an individual round.',
    default: [10, 7, 5, 3],
    min: 0,
    max: 1_000,
    maxItems: 20,
    ...owner('O11'),
    ...admin,
  },
  {
    key: 'points.individualOtherSolver',
    kind: 'int',
    label: 'Points for every further solver',
    help: 'Match points for a solver placed after the list above.',
    default: 1,
    min: 0,
    max: 1_000,
    unit: '',
    ...owner('O11'),
    ...admin,
  },
  {
    key: 'fairness.commitReveal',
    kind: 'bool',
    label: 'Fairness proof',
    help: "Publish the round seed's hash at creation and the seed at the end.",
    default: true,
    ...owner('O9'),
    ...admin,
  },
];

export const PLATFORM_ROUND_SETTINGS: readonly SettingDef[] = [
  ...ROUND_SETTINGS,
  ...SPECIAL_SETTINGS,
];

export interface PointsTable {
  readonly sharedWinner: number;
  readonly individualPlaces: readonly number[];
  readonly individualOtherSolver: number;
}

// The platform's frozen round values, in the units the engine works in.
export interface PlatformRoundConfig {
  readonly secretMode: SecretMode;
  readonly cooldownMs: number;
  // Out of the round after this long without a guess, 0 = off; warned after inactivityWarnMs
  // (O71, ../domain round/inactivity).
  readonly inactivityLimitMs: number;
  readonly inactivityWarnMs: number;
  readonly countdownMs: number;
  readonly maxDurationMs: number;
  readonly marginWindowMs: number;
  readonly specialOn: boolean;
  readonly teamsOn: boolean;
  readonly halving: boolean;
  readonly commitReveal: boolean;
  readonly points: PointsTable;
  readonly specials: SpecialTiming;
}

// Values come from resolveSettings and the host's checked choices, so each has its kind.
export function readPlatformRound(
  values: Readonly<Record<string, SettingValue>>,
): PlatformRoundConfig {
  const num = (key: string) => values[key] as number;
  const flag = (key: string) => values[key] as boolean;
  return {
    secretMode: values['round.secretMode'] as SecretMode,
    cooldownMs: num('round.cooldownS') * 1_000,
    inactivityLimitMs: num('round.inactivityLimitS') * 1_000,
    inactivityWarnMs: num('round.inactivityWarnS') * 1_000,
    countdownMs: num('round.countdownS') * 1_000,
    maxDurationMs: num('round.maxDurationMin') * 60_000,
    marginWindowMs: num('round.marginWindowS') * 1_000,
    specialOn: flag('round.specialOn'),
    teamsOn: flag('round.teamsOn'),
    halving: flag('round.halving'),
    commitReveal: flag('fairness.commitReveal'),
    points: {
      sharedWinner: num('points.sharedWinner'),
      individualPlaces: values['points.individualPlaces'] as readonly number[],
      individualOtherSolver: num('points.individualOtherSolver'),
    },
    specials: readSpecialTiming(values),
  };
}

// The platform's one cross-key rule (O71): with the limit on, the warning comes before it.
// Each key's own bounds are checked first (settingIssue); null when the values fit, else the
// warning field's issue in the one wording every form and refusal shows (O74).
export function inactivityIssue(
  values: Readonly<Record<string, SettingValue>>,
): SettingIssue | null {
  const limit = values['round.inactivityLimitS'];
  const warn = values['round.inactivityWarnS'];
  if (typeof limit !== 'number' || typeof warn !== 'number' || limit === 0) return null;
  if (warn < limit) return null;
  return { key: 'round.inactivityWarnS', message: 'The warning must be shorter than the limit.' };
}
