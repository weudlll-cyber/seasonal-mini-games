/**
 * @file   games/seasonal-target/src/settings.ts
 * @module games/seasonal-target
 * @brief  The game's own keys of document `game.seasonal-target` and its frozen config.
 *
 * Responsibility: the grid's size (one square side, 8–30 tiles, owner O45), the answer mode
 *                 (`direction`, `distance` — the default — or `closeness`, owner O39 amended by
 *                 O43) and where Leaf Fall and halving stop (08 §3.3), beside the guess
 *                 engine's shared keys (feedback visibility, comments, trend lines, the repeat
 *                 rule) worded for tiles; reading frozen values into the config, whose width and
 *                 height are both the size. No rule across keys: every size and stop inside its
 *                 bounds makes a playable round, the stops' maxima fitting the smallest grid.
 *                 Halving is always allowed: the grid is always shown (02d §3, §8.4). The
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

const defs: readonly SettingDef[] = [
  // The square grid's side (O45, amending O38's 50 × 50 map): columns from the west edge,
  // rows from the north edge.
  {
    key: 'target.size',
    kind: 'int',
    label: 'Grid size',
    help: 'Tiles per side of the square grid; column 1 is the west edge, row 1 the north edge.',
    default: 20,
    min: 8,
    max: 30,
    unit: 'tiles',
    status: 'owner',
    decision: 'O45',
    spec: '08 §3.3',
    ...host,
  },
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
    'Shared mode. own: that someone guessed; numbers: also the tile; full: also the answer.',
  ),
  COMMENTS_DEF,
  TREND_DEF,
  repeatDef('A tile the player already tried is refused without cost.'),
  {
    key: 'autumn.minCellsLeft',
    kind: 'int',
    label: 'Leaf Fall stops at',
    help: 'Falls stop when fewer tiles than this would be left where the target can be.',
    default: 10,
    min: 2,
    // The smallest grid has 64 tiles: a higher stop would never let a tile fall there.
    max: 50,
    unit: 'tiles',
    ...proposal,
    ...admin,
  },
  {
    key: 'halving.minCells',
    kind: 'int',
    label: 'Halving stops at',
    help: 'The target area is not halved any more once it has this many tiles or fewer.',
    default: 16,
    min: 4,
    // Below the smallest grid's 64 tiles, so halving always runs at least once.
    max: 32,
    unit: 'tiles',
    ...proposal,
    ...admin,
  },
];

export const stSettings: GameSettings<StConfig> = {
  defs,
  read: (values) => ({
    // Square: the geometry keeps a width and a height.
    width: values['target.size'] as number,
    height: values['target.size'] as number,
    feedback: values['target.feedback'] as FeedbackMode,
    ...readGuessConfig(values),
    autumnMinCellsLeft: values['autumn.minCellsLeft'] as number,
    halvingMinCells: values['halving.minCells'] as number,
  }),
  problem: () => null,
  // The grid is always shown, so a target area tells nothing a hidden setting would keep.
  halvingAllowed: () => true,
};
