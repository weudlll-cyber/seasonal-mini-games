/**
 * @file   games/bomb-defusal/src/settings.ts
 * @module games/bomb-defusal
 * @brief  The game's own keys of document `game.bomb-defusal` and its frozen config.
 *
 * Responsibility: wires, cuts and the explosion penalty (host, 08 §3.2) as setting
 *                 definitions, beside the guess engine's shared ones (feedback visibility,
 *                 comments, trend lines, the repeated-sequence rule) worded for wires; reading frozen values into the
 *                 config; the cross-key rule that cuts never exceed wires; and that this game
 *                 has no halving (02c §8.5): a halving day runs a normal season round. The
 *                 platform's round keys come first in the document (game-sdk).
 * Depends on:     @smg/game-sdk (SettingDef, GameSettings), @smg/guess-engine (shared keys)
 * Used by:        ./module, ./state, ./index, ./web (forms)
 * Spec:           docs/spec/08-admin-settings.md §3.2; docs/spec/02c-game-bomb-defusal.md §3, §8.5
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

export interface BdConfig extends GuessConfig {
  readonly wires: number;
  readonly cuts: number;
  // Added to the cooldown on a wrong first cut (O40); 0 explodes without extra waiting.
  readonly explosionPenaltyS: number;
}

const GAME_ADMIN = 'settings.game.edit';
const host = { editPermission: GAME_ADMIN, hostChooses: true, running: 'frozen' } as const;
const proposal = { status: 'proposal', spec: '08 §3.2' } as const;

const defs: readonly SettingDef[] = [
  {
    key: 'bomb.wires',
    kind: 'int',
    label: 'Wires',
    help: 'How many wires the bomb has: the first ones of red, blue, yellow, green, white, black, orange, purple.',
    default: 6,
    min: 4,
    max: 8,
    unit: '',
    ...proposal,
    ...host,
  },
  {
    key: 'bomb.cuts',
    kind: 'int',
    label: 'Cuts',
    help: 'How many different wires must be cut in the right order; at most the number of wires.',
    default: 4,
    min: 3,
    max: 6,
    unit: '',
    ...proposal,
    ...host,
  },
  {
    key: 'bomb.explosionPenaltyS',
    kind: 'int',
    label: 'Explosion penalty',
    help: 'Extra waiting time after a wrong first cut, the same for every round of the match. 0: the bomb explodes without extra waiting.',
    default: 5,
    min: 0,
    max: 30,
    unit: 's',
    status: 'owner',
    decision: 'O40',
    spec: '08 §3.2',
    ...host,
  },
  visibilityDef(
    'Shared mode. own: that someone cut a sequence; numbers: also the sequence; full: also how many cuts were right, the explosion and the comment.',
  ),
  COMMENTS_DEF,
  TREND_DEF,
  repeatDef('A cutting order the player already tried is refused without cost.'),
];

export const bdSettings: GameSettings<BdConfig> = {
  defs,
  read: (values) => ({
    wires: values['bomb.wires'] as number,
    cuts: values['bomb.cuts'] as number,
    explosionPenaltyS: values['bomb.explosionPenaltyS'] as number,
    ...readGuessConfig(values),
  }),
  problem: (cfg) =>
    cfg.cuts > cfg.wires ? 'The number of cuts must not be more than the number of wires.' : null,
  // No halving in this game (02c §8.5): a halving day runs a normal season round.
  halvingAllowed: () => false,
};
