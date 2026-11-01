/**
 * @file   games/seasonal-target/src/settings.ts
 * @module games/seasonal-target
 * @brief  The game's own keys of document `game.seasonal-target` and its frozen config.
 *
 * Responsibility: the map's width and height, the answer mode (`direction`, `distance` — the
 *                 default — or `closeness`, owner O39 amended by O43) and where Leaf Fall and halving stop (08 §3.3), beside the guess
 *                 engine's shared keys (feedback visibility, comments, trend lines, the repeat
 *                 rule) worded for cells; reading frozen values into the config. No rule across
 *                 keys: every width, height and stop inside its bounds makes a playable round.
 *                 Halving is always allowed: the map is always shown (02d §3, §8.4). The
 *                 platform's round keys (`autumn.count`, `halving.intervalS` …) come first in
 *                 the document (game-sdk).
 * Depends on:     @smg/game-sdk (SettingDef, GameSettings), @smg/guess-engine (shared keys),
 *                 ./geometry (FEEDBACK_MODES, FeedbackMode)
 * Used by:        ./module, ./index, ../web/index
 * Spec:           docs/spec/08-admin-settings.md §3.3; docs/spec/02d-game-seasonal-target.md §3
 */
import type { GameSettings, SettingDef } from '@smg/game-sdk';
import {
  COMMENTS_DEF,
  readGuessConfig,
  repeatDef,
  TREND_DEF,
  visibilityDef,
  type GuessConfig,
} from '@smg/guess-engine';

import { FEEDBACK_MODES, type FeedbackMode } from './geometry.js';

export interface StConfig extends GuessConfig {
  readonly width: number;
  readonly height: number;
  readonly feedback: FeedbackMode;
  readonly autumnMinCellsLeft: number;
  readonly halvingMinCells: number;
}

const GAME_ADMIN = 'settings.game.edit';
const host = { editPermission: GAME_ADMIN, hostChooses: true, running: 'frozen' } as const;
const admin = { editPermission: GAME_ADMIN, hostChooses: false, running: 'frozen' } as const;
const proposal = { status: 'proposal', spec: '08 §3.3' } as const;

// One side of the map, 20–100 cells (02d §3).
const side = (key: string, label: string, help: string): SettingDef => ({
  key,
  kind: 'int',
  label,
  help,
  default: 50,
  min: 20,
  max: 100,
  unit: 'cells',
  ...proposal,
  ...host,
});

const defs: readonly SettingDef[] = [
  side('map.width', 'Map width', 'Columns of the map, counted from the west edge.'),
  side('map.height', 'Map height', 'Rows of the map; row 1 is the north edge.'),
  {
    key: 'target.feedback',
    kind: 'enum',
    label: 'Answers',
    help:
      'direction: cells away and the compass direction (easier); distance: only how many cells ' +
      'away; closeness: only warm or cold (harder).',
    default: 'distance',
    options: FEEDBACK_MODES,
    status: 'owner',
    decision: 'O43',
    spec: '08 §3.3',
    ...host,
  },
  visibilityDef(
    'Shared mode. own: that someone guessed; numbers: also the cell; full: also the answer.',
  ),
  COMMENTS_DEF,
  TREND_DEF,
  repeatDef('A cell the player already tried is refused without cost.'),
  {
    key: 'autumn.minCellsLeft',
    kind: 'int',
    label: 'Leaf Fall stops at',
    help: 'Falls stop when fewer cells than this would be left where the target can be.',
    default: 10,
    min: 2,
    max: 1_000,
    unit: 'cells',
    ...proposal,
    ...admin,
  },
  {
    key: 'halving.minCells',
    kind: 'int',
    label: 'Halving stops at',
    help: 'The target area is not halved any more once it has this many cells or fewer.',
    default: 16,
    min: 4,
    max: 400,
    unit: 'cells',
    ...proposal,
    ...admin,
  },
];

export const stSettings: GameSettings<StConfig> = {
  defs,
  read: (values) => ({
    width: values['map.width'] as number,
    height: values['map.height'] as number,
    feedback: values['target.feedback'] as FeedbackMode,
    ...readGuessConfig(values),
    autumnMinCellsLeft: values['autumn.minCellsLeft'] as number,
    halvingMinCells: values['halving.minCells'] as number,
  }),
  problem: () => null,
  // The map is always shown, so a target area tells nothing a hidden setting would keep.
  halvingAllowed: () => true,
};
