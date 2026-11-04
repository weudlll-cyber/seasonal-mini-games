/**
 * @file   games/seasonal-target/src/module.ts
 * @module games/seasonal-target
 * @brief  Seasonal Target as one GameModule, built by the guess engine from the game's parts.
 *
 * Responsibility: put the game's parts (meta, settings, the cell input, the uniform target,
 *                 state, rules, comment lines, its own events, views and specials) together
 *                 through `guessModule` (04 §4.7), so the platform runs it behind the contract
 *                 of 04 §4 without knowing anything else about it.
 * Depends on:     zod, @smg/game-sdk (GameModule), @smg/guess-engine (guessModule),
 *                 ./commentLines, ./rules, ./secrets, ./settings, ./specials, ./state, ./views
 * Used by:        ./index, ./fakes, games/registry
 * Spec:           docs/spec/02d-game-seasonal-target.md; docs/spec/04-software-architecture.md §4, §4.7
 */
import type { GameModule } from '@smg/game-sdk';
import { guessModule } from '@smg/guess-engine';
import { z } from 'zod';

import { stComments } from './commentLines.js';
import { MAP_LIMIT, stRules, type GuessAction } from './rules.js';
import { drawSecret, type Secrets } from './secrets.js';
import { stSettings, type StConfig } from './settings.js';
import { stSpecials } from './specials.js';
import { createState, evolveGame, type StEvent, type StState } from './state.js';
import { reveal, views, viewSchemas } from './views.js';

// One side's coordinate: a whole number the largest grid can have; check 4 tests this round's.
const coordinate = z.number().int().min(1).max(MAP_LIMIT);

export const seasonalTarget: GameModule<StState, GuessAction, StEvent, StConfig, Secrets> =
  guessModule({
    meta: {
      id: 'seasonal-target',
      name: 'Seasonal Target',
      contractVersion: 1,
      timing: 'cooldown',
      secretModes: ['shared', 'individual'],
      teams: true,
    },
    settings: stSettings,
    valueSchema: z.object({ x: coordinate, y: coordinate }).strict(),
    drawSecret,
    createState,
    rules: stRules,
    picker: stComments,
    evolveGame,
    views,
    viewSchemas,
    specials: stSpecials,
    reveal,
  });
