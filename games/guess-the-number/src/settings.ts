/**
 * @file   games/guess-the-number/src/settings.ts
 * @module games/guess-the-number
 * @brief  The game's own keys of document `game.guess-the-number` and its frozen config.
 *
 * Responsibility: range (negative numbers allowed, O18) and whether players see it (O19),
 *                 feedback visibility, the closeness comments (O21) with their tier thresholds
 *                 and how often a trend line comes, the repeated-guess rule and the game's
 *                 parts of the specials (Spring Herald's hint type, where Leaf Fall and halving
 *                 stop) (08 §3) as setting definitions;
 *                 reading frozen values into the config; the cross-key rules that a range holds
 *                 at least 10 numbers (`rangeHigh` ≥ `rangeLow` + 9) and that the thresholds
 *                 fall from way off to hot; and that a hidden range allows no halving (T55).
 *                 The platform's round keys come first in the document (game-sdk).
 * Depends on:     @smg/game-sdk (SettingDef, GameSettings), ./closeness (Thresholds)
 * Used by:        ./module, ./index
 * Spec:           docs/spec/08-admin-settings.md §3, docs/spec/02-game-guess-the-number.md §3, §5.1, §6.2
 */
import type { GameSettings, SettingDef } from '@smg/game-sdk';

import type { Thresholds } from './closeness.js';

export type Visibility = 'own' | 'numbers' | 'full';

export interface GtnConfig {
  readonly rangeLow: number;
  readonly rangeHigh: number;
  // Off: players are not told the range until the end (O19, 02 §3).
  readonly rangeVisible: boolean;
  readonly feedbackVisibility: Visibility;
  // A closeness comment on every guess (O21), with the tiers' thresholds in percent.
  readonly comments: boolean;
  readonly thresholds: Thresholds;
  // How often a change of tier gets a trend line instead of a tier line, in percent.
  readonly trendPercent: number;
  readonly repeatGuessRejected: boolean;
  readonly springHintType: 'parity' | 'half';
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
  {
    key: 'round.feedbackVisibility',
    kind: 'enum',
    label: 'What others see of a guess',
    help: 'Shared mode. own: that someone guessed; numbers: also the number; full: also the answer.',
    default: 'full',
    options: ['own', 'numbers', 'full'],
    ...owner('O8'),
    ...host,
  },
  {
    key: 'round.comments',
    kind: 'bool',
    label: 'Closeness comments',
    help: 'A short comment on how close each guess came, shown with its answer.',
    default: true,
    ...owner('O21'),
    ...host,
  },
  threshold('wayOff', 'way off', [50, 20, 90]),
  threshold('cold', 'cold', [25, 10, 60]),
  threshold('cool', 'cool', [10, 3, 40]),
  threshold('warm', 'warm', [3, 1, 20]),
  threshold('hot', 'hot', [1, 0.5, 10]),
  {
    key: 'comments.trendPercent',
    kind: 'int',
    label: 'Trend lines',
    help: 'How often a guess in another tier than the player’s last one gets a "getting warmer" or "wrong way" line instead.',
    default: 33,
    min: 0,
    max: 100,
    unit: '%',
    ...proposal,
    ...admin,
  },
  {
    key: 'round.repeatGuessRejected',
    kind: 'bool',
    label: 'Refuse repeated guesses',
    help: 'A number the player already guessed is refused without cost.',
    default: true,
    ...owner('O15'),
    ...admin,
  },
  {
    key: 'spring.hintType',
    kind: 'enum',
    label: 'Spring Herald hint',
    help: 'parity: odd or even; half: lower or upper half of the range.',
    default: 'parity',
    options: ['parity', 'half'],
    ...owner('O15'),
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
    feedbackVisibility: values['round.feedbackVisibility'] as Visibility,
    comments: values['round.comments'] as boolean,
    thresholds: {
      wayOff: values['comments.wayOffAbove'] as number,
      cold: values['comments.coldAbove'] as number,
      cool: values['comments.coolAbove'] as number,
      warm: values['comments.warmAbove'] as number,
      hot: values['comments.hotAbove'] as number,
    },
    trendPercent: values['comments.trendPercent'] as number,
    repeatGuessRejected: values['round.repeatGuessRejected'] as boolean,
    springHintType: values['spring.hintType'] as 'parity' | 'half',
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
