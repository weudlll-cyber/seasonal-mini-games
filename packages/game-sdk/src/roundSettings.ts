/**
 * @file   packages/game-sdk/src/roundSettings.ts
 * @module game-sdk
 * @brief  The platform's round keys that every game's settings document carries.
 *
 * Responsibility: the definitions of 08 §3 that are rules of the platform, not of one game
 *                 (secret mode, cooldown, countdown, longest round, winning margin, season
 *                 source and toggles, points, fairness proof), and how their frozen values
 *                 become the platform's round config in milliseconds. A game's document is
 *                 these keys followed by the game's own (GameSettings.defs).
 * Depends on:     ./settings, ./module
 * Used by:        ./index, packages/domain (round config), packages/application, games/*
 * Spec:           docs/spec/08-admin-settings.md §3, docs/spec/02-game-guess-the-number.md §3, §9
 */
import type { SecretMode } from './module.js';
import type { SettingDef, SettingValue } from './settings.js';

const GAME_ADMIN = 'settings.game.edit';

// Who and when for the two kinds of round keys (08 §2): the host picks per round, or a game
// admin sets it for every round. Both are frozen into a round at creation.
const host = { editPermission: GAME_ADMIN, hostChooses: true, running: 'frozen' } as const;
const admin = { editPermission: GAME_ADMIN, hostChooses: false, running: 'frozen' } as const;
const owner = (decision: string) => ({ status: 'owner', decision, spec: '08 §3' }) as const;

export const PLATFORM_ROUND_SETTINGS: readonly SettingDef[] = [
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
  {
    key: 'round.countdownS',
    kind: 'int',
    label: 'Countdown before opening',
    help: 'Time between Start round and the first guess.',
    default: 5,
    min: 3,
    max: 30,
    unit: 's',
    ...owner('O15'),
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
    status: 'proposal',
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

export interface PointsTable {
  readonly sharedWinner: number;
  readonly individualPlaces: readonly number[];
  readonly individualOtherSolver: number;
}

// The platform's frozen round values, in the units the engine works in.
export interface PlatformRoundConfig {
  readonly secretMode: SecretMode;
  readonly cooldownMs: number;
  readonly countdownMs: number;
  readonly maxDurationMs: number;
  readonly marginWindowMs: number;
  readonly specialOn: boolean;
  readonly teamsOn: boolean;
  readonly halving: boolean;
  readonly commitReveal: boolean;
  readonly points: PointsTable;
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
  };
}
