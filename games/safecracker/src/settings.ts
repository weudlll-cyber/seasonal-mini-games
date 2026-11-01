/**
 * @file   games/safecracker/src/settings.ts
 * @module games/safecracker
 * @brief  The game's own keys of document `game.safecracker` and its frozen config.
 *
 * Responsibility: the code's length and the digits in use (host, per round) and the digits per
 *                 Leaf Fall (game admin) as setting definitions (08 §3.1), beside the guess
 *                 engine's shared ones (feedback visibility, comments, trend lines, the
 *                 repeated-guess rule) worded for codes; reading frozen values into the config.
 *                 Every combination of the bounds is playable, so there is no cross-key rule;
 *                 the game has no halving round (02b §7.4), so a halving day runs a normal
 *                 season round. The platform's round keys come first in the document (game-sdk).
 * Depends on:     @smg/game-sdk (SettingDef, GameSettings), @smg/guess-engine (shared keys)
 * Used by:        ./module, ./index, ./conformance, ./fakes
 * Spec:           docs/spec/08-admin-settings.md §3.1; docs/spec/02b-game-safecracker.md §3, §7.3, §7.4
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

// The engine's keys (visibility, comments, trend lines, repeats) and the game's own.
export interface ScConfig extends GuessConfig {
  // Digits in the secret code, 3–6.
  readonly codeLength: number;
  // The digits 0 … codeDigits − 1 are in use, 4–10.
  readonly codeDigits: number;
  // Digits that fall per Leaf Fall; replaces the platform's `autumn.count` (02b §7.3).
  readonly digitsPerFall: number;
}

const GAME_ADMIN = 'settings.game.edit';
const host = { editPermission: GAME_ADMIN, hostChooses: true, running: 'frozen' } as const;
const admin = { editPermission: GAME_ADMIN, hostChooses: false, running: 'frozen' } as const;
const proposal = { status: 'proposal', spec: '08 §3.1' } as const;

const defs: readonly SettingDef[] = [
  {
    key: 'code.length',
    kind: 'int',
    label: 'Code length',
    help: 'How many digits the secret code has.',
    default: 4,
    min: 3,
    max: 6,
    unit: 'digits',
    ...proposal,
    ...host,
  },
  {
    key: 'code.digits',
    kind: 'int',
    label: 'Digits in use',
    help: 'The code uses the digits from 0 up to one less than this; a digit may repeat.',
    default: 10,
    min: 4,
    max: 10,
    unit: '',
    ...proposal,
    ...host,
  },
  visibilityDef(
    'Shared mode. own: that someone tried a code; numbers: also the code; full: also the right and wrong places.',
  ),
  COMMENTS_DEF,
  TREND_DEF,
  repeatDef('A code the player already tried is refused without cost.'),
  {
    key: 'autumn.digitsPerFall',
    kind: 'int',
    label: 'Digits per Leaf Fall',
    help: 'How many digits that are in no code fall out at each Leaf Fall.',
    default: 1,
    min: 1,
    max: 3,
    unit: '',
    ...proposal,
    ...admin,
  },
];

export const scSettings: GameSettings<ScConfig> = {
  defs,
  read: (values) => ({
    codeLength: values['code.length'] as number,
    codeDigits: values['code.digits'] as number,
    digitsPerFall: values['autumn.digitsPerFall'] as number,
    ...readGuessConfig(values),
  }),
  // Every length 3–6 with 4–10 digits gives at least 64 codes: no rule across keys.
  problem: () => null,
  // No halving hook (02b §7.4): a halving day runs a normal season round (T55).
  halvingAllowed: () => false,
};
