/**
 * @file   games/bomb-defusal/src/module.ts
 * @module games/bomb-defusal
 * @brief  Seasonal Bomb Defusal as one GameModule, built by the guess engine from the game's parts.
 *
 * Responsibility: put the game's parts (meta, settings, the wire-sequence input, the uniform
 *                 secret order, state, rules with the explosion, comment lines, its own events,
 *                 views and specials) together through `guessModule` (04 §4.7), so the platform
 *                 runs it behind the contract of 04 §4 without knowing anything else about it.
 *                 The secret is `cuts` different wires of the round in an order drawn
 *                 uniformly (a partial shuffle, the engine's `pickDistinct`) under
 *                 `secret/shared` or `secret/<playerId>` (02c §3).
 * Depends on:     @smg/game-sdk (GameModule), @smg/guess-engine (guessModule, picker, secrets),
 *                 ./commentLines, ./rules, ./settings, ./specials, ./state, ./views, ./wires
 * Used by:        ./index, ./fakes, games/registry
 * Spec:           docs/spec/02c-game-bomb-defusal.md; docs/spec/04-software-architecture.md §4, §4.7
 */
import type { GameModule } from '@smg/game-sdk';
import { commentPicker, guessModule, pickDistinct, type Secrets } from '@smg/guess-engine';

import { COMMENT_LINES } from './commentLines.js';
import { bdRules, type GuessAction } from './rules.js';
import { bdSettings, type BdConfig } from './settings.js';
import { bdSpecials } from './specials.js';
import { createState, evolveGame, type BdEvent, type BdState } from './state.js';
import { reveal, views, viewSchemas } from './views.js';
import { sequenceSchema, wiresOf, type Sequence } from './wires.js';

export const bombDefusal: GameModule<
  BdState,
  GuessAction,
  BdEvent,
  BdConfig,
  Secrets<Sequence>
> = guessModule({
  meta: {
    id: 'bomb-defusal',
    name: 'Seasonal Bomb Defusal',
    contractVersion: 1,
    timing: 'cooldown',
    secretModes: ['shared', 'individual'],
    teams: true,
  },
  settings: bdSettings,
  // Palette names only, at most six (05 §3.1); length and the round's wires are check 4.
  valueSchema: sequenceSchema,
  drawSecret: (rng, config): Sequence => pickDistinct(wiresOf(config.wires), config.cuts, rng),
  createState,
  rules: bdRules,
  picker: commentPicker(COMMENT_LINES),
  evolveGame,
  views,
  viewSchemas,
  specials: bdSpecials,
  reveal,
});
