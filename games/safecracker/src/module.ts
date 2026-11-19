/**
 * @file   games/safecracker/src/module.ts
 * @module games/safecracker
 * @brief  Seasonal Safecracker as one GameModule, built by the guess engine from the game's parts.
 *
 * Responsibility: put the game's parts (meta, settings, the code input, the uniform code per
 *                 position, state, rules, the safe's comment lines, its own events, views and
 *                 specials) together through `guessModule` (04 §4.7), so the platform runs it
 *                 behind the contract of 04 §4 without knowing anything else about it. Its
 *                 match chat is docked under the round view and the result, with a one-line
 *                 bar on a phone (`chatDock` 'below', `chatBar` 'line', owner decision O109).
 * Depends on:     zod, @smg/game-sdk (GameModule), @smg/guess-engine (guessModule, picker,
 *                 secrets), ./commentLines, ./rules, ./settings, ./specials, ./state, ./views
 * Used by:        ./index, ./fakes, games/registry
 * Spec:           docs/spec/02b-game-safecracker.md; docs/spec/04-software-architecture.md §4, §4.7
 */
import type { Drbg, GameModule } from '@smg/game-sdk';
import { commentPicker, guessModule, type Secrets } from '@smg/guess-engine';
import { z } from 'zod';

import { COMMENT_LINES } from './commentLines.js';
import { CODE_PATTERN, scRules, type GuessAction } from './rules.js';
import { scSettings, type ScConfig } from './settings.js';
import { scSpecials } from './specials.js';
import { createState, evolveGame, type ScEvent, type ScState } from './state.js';
import { reveal, views, viewSchemas } from './views.js';

// One code: each position a uniform digit in use, repeats allowed (02b §3).
const drawCode = (rng: Drbg, config: ScConfig): string =>
  Array.from({ length: config.codeLength }, () => String(rng.nextInt(config.codeDigits))).join('');

export const safecracker: GameModule<
  ScState,
  GuessAction,
  ScEvent,
  ScConfig,
  Secrets<string>
> = guessModule({
  meta: {
    id: 'safecracker',
    name: 'Seasonal Safecracker',
    contractVersion: 1,
    timing: 'cooldown',
    secretModes: ['shared', 'individual'],
    teams: true,
    // The match chat docked under the round and the result, a one-line bar on a phone
    // (owner decision O109, 02 §12).
    chatDock: 'below',
    chatBar: 'line',
  },
  settings: scSettings,
  // A string of digits, so leading zeros are kept; the round's length and digits are check 4.
  valueSchema: z.string().max(6).regex(CODE_PATTERN),
  drawSecret: drawCode,
  createState,
  rules: scRules,
  picker: commentPicker(COMMENT_LINES),
  evolveGame,
  views,
  viewSchemas,
  specials: scSpecials,
  reveal,
});
