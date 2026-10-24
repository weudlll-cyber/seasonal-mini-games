/**
 * @file   games/guess-the-number/src/module.ts
 * @module games/guess-the-number
 * @brief  Guess The Number as one GameModule: meta, settings, action schema, rules and views.
 *
 * Responsibility: put the game's parts together behind the contract of 04 §4, so the
 *                 platform runs it without knowing anything else about it.
 * Depends on:     zod, @smg/game-sdk (GameModule), ./rules, ./secrets, ./settings, ./state, ./views
 * Used by:        ./index, games/registry
 * Spec:           docs/spec/02-game-guess-the-number.md, docs/spec/04-software-architecture.md §4
 */
import type { GameModule } from '@smg/game-sdk';
import { z } from 'zod';

import { decide, validate, type GuessAction } from './rules.js';
import { deriveSecrets, type Secrets } from './secrets.js';
import { gtnSettings, type GtnConfig } from './settings.js';
import { createState, evolve, type GtnEvent, type GtnState } from './state.js';
import { views, viewSchemas } from './views.js';

export const guessTheNumber: GameModule<GtnState, GuessAction, GtnEvent, GtnConfig, Secrets> = {
  meta: {
    id: 'guess-the-number',
    name: 'Guess The Number',
    contractVersion: 1,
    timing: 'cooldown',
    secretModes: ['shared', 'individual'],
    teams: true,
  },
  settings: gtnSettings,
  // Any finite number; whether it is a whole number in range is check 4 (OUT_OF_RANGE).
  actionSchema: z.object({ value: z.number() }).strict(),
  deriveSecrets,
  createRound: createState,
  validate,
  decide,
  evolve,
  views,
  viewSchemas,
};
