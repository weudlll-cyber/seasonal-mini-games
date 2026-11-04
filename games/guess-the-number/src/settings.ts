/**
 * @file   games/guess-the-number/src/settings.ts
 * @module games/guess-the-number
 * @brief  The game's own keys of document `game.guess-the-number` and its frozen config.
 *
 * Responsibility: range (negative numbers allowed, O18) and whether players see it (O19), the
 *                 closeness comments' tier thresholds and the game's parts of the specials
 *                 (Spring Herald's hint type, where Leaf Fall and halving stop) (08 §3) as
 *                 setting definitions, beside the guess engine's shared ones (feedback
 *                 visibility, comments, trend lines, the repeated-guess rule) worded for
 *                 numbers; reading frozen values into the config; the cross-key rules that a
 *                 range holds at least 10 numbers (`rangeHigh` ≥ `rangeLow` + 9) and that the
 *                 thresholds fall from way off to hot; and that a hidden range allows no
 *                 halving (T55). The platform's round keys come first in the document (game-sdk).
 * Depends on:     @smg/game-sdk (SettingDef, GameSettings), @smg/guess-engine (shared keys),
 *                 ./closeness (Thresholds)
 * Used by:        ./module, ./index
 * Spec:           docs/spec/08-admin-settings.md §3, docs/spec/02-game-guess-the-number.md §3, §5.1, §6.2
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

import type { Thresholds } from './closeness.js';

export type { Visibility } from '@smg/guess-engine';

// The engine's keys (visibility, comments, trend lines, repeats) and the game's own.
export interface GtnConfig extends GuessConfig {
  readonly rangeLow: number;
  readonly rangeHigh: number;
  // Off: players are not told the range until the end (O19, 02 §3).
  readonly rangeVisible: boolean;
  // The tiers' thresholds in percent of the range's width (O21).
  readonly thresholds: Thresholds;
  readonly springHintType: 'lastDigit' | 'half';
  readonly autumnMinRemaining: number;
  readonly halvingMinRangeSize: number;
}

const GAME_ADMIN = 'settings.game.edit';
const host = { editPermission: GAME_ADMIN, hostChooses: true, running: 'frozen' } as const;
const owner = (decision: string) => ({ status: 'owner', decision, spec: '08 §3' }) as const;
const admin = { editPermission: GAME_ADMIN, hostChooses: false, running: 'frozen' } as const;
const proposal = { status: 'proposal', spec: '08 §3' } as const;

// One closeness threshold: percent of the range's width, in half-percent steps (O21, proposal).
// `word` names the tier ("way off"); `bounds` is [default, min, max].
function threshold(
  tier: keyof Thresholds,
  word: string,
  bounds: readonly [number, number, number],
) {
  const [value, min, max] = bounds;
  return {
    key: `comments.${tier}Above`,
    kind: 'number',
    label: `${word.charAt(0).toUpperCase()}${word.slice(1)} above`,
    help: `A guess farther from the secret than this share of the range's width is "${word}".`,
    default: value,
    min,
    max,
    step: 0.5,
    unit: '%',
    ...proposal,
    ...admin,
  } as const;
}

const defs: readonly SettingDef[] = [
  {
    key: 'round.rangeLow',
    kind: 'int',
    label: 'Lowest number',
    help: 'The secret is at least this. Negative numbers are allowed.',
    default: 1,
    min: -1_000_000,
    max: 1_000_000,
    unit: '',
    ...owner('O18'),
    ...host,
  },
  {
    key: 'round.rangeHigh',
    kind: 'int',
    label: 'Highest number',
    help: 'The secret is at most this; at least 9 above the lowest number.',
    default: 1_000,
    min: -1_000_000,
    max: 1_000_000,
    unit: '',
    ...owner('O18'),
    ...host,
  },
  {
    key: 'round.rangeVisible',
    kind: 'bool',
    label: 'Show range',
    help: 'Off: players are not told the lowest and highest number until the end.',
    default: true,
    ...owner('O19'),
    ...host,
  },
  visibilityDef(
    'Shared mode. own: that someone guessed; numbers: also the number; full: also the answer.',
  ),
  COMMENTS_DEF,
  threshold('wayOff', 'way off', [50, 20, 90]),
  threshold('cold', 'cold', [25, 10, 60]),
  threshold('cool', 'cool', [10, 3, 40]),
  threshold('warm', 'warm', [3, 1, 20]),
  threshold('hot', 'hot', [1, 0.5, 10]),
  TREND_DEF,
  repeatDef('A number the player already guessed is refused without cost.'),
  {
    key: 'spring.hintType',
    kind: 'enum',
    label: 'Spring Herald hint',
    help: 'lastDigit: the last digit of the number; half: lower or upper half of the range.',
    default: 'lastDigit',
    options: ['lastDigit', 'half'],
    ...owner('O56'),
    ...admin,
  },
  {
    key: 'autumn.minRemaining',
    kind: 'int',
    label: 'Leaf Fall stops at',
    help: 'Falls stop when fewer numbers than this would be left in the range.',
    default: 10,
    min: 2,
    max: 1_000,
    unit: '',
    ...owner('O15'),
    ...admin,
  },
  {
    key: 'halving.minRangeSize',
    kind: 'int',
    label: 'Halving stops at',
    help: 'The range is not halved any more once it holds this many numbers or fewer.',
    default: 8,
    min: 2,
    max: 100,
    unit: '',
    ...owner('O15'),
    ...admin,
  },
];

export const gtnSettings: GameSettings<GtnConfig> = {
  defs,
  read: (values) => ({
    rangeLow: values['round.rangeLow'] as number,
    rangeHigh: values['round.rangeHigh'] as number,
    rangeVisible: values['round.rangeVisible'] as boolean,
    ...readGuessConfig(values),
    thresholds: {
      wayOff: values['comments.wayOffAbove'] as number,
      cold: values['comments.coldAbove'] as number,
      cool: values['comments.coolAbove'] as number,
      warm: values['comments.warmAbove'] as number,
      hot: values['comments.hotAbove'] as number,
    },
    springHintType: values['spring.hintType'] as 'lastDigit' | 'half',
    autumnMinRemaining: values['autumn.minRemaining'] as number,
    halvingMinRangeSize: values['halving.minRangeSize'] as number,
  }),
  problem: (cfg) => {
    if (cfg.rangeHigh < cfg.rangeLow + 9)
      return 'The highest number must be at least 9 above the lowest.';
    const t = cfg.thresholds;
    const falling = t.wayOff > t.cold && t.cold > t.cool && t.cool > t.warm && t.warm > t.hot;
    return falling ? null : 'The comment thresholds must fall from way off to hot.';
  },
  // Halving would tell players where the range is: a hidden range runs as a normal season
  // round instead (proposal, docs/OPEN.md).
  halvingAllowed: (cfg) => cfg.rangeVisible,
};
