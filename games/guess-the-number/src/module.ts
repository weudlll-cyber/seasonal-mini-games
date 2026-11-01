/**
 * @file   games/guess-the-number/src/module.ts
 * @module games/guess-the-number
 * @brief  Guess The Number as one GameModule, built by the guess engine from the game's parts.
 *
 * Responsibility: put the game's parts (meta, settings, the whole-number input, the uniform
 *                 secret, state, rules, comment lines, its own events, views and specials)
 *                 together through `guessModule` (04 §4.7), so the platform runs it behind the
 *                 contract of 04 §4 without knowing anything else about it.
 * Depends on:     zod, @smg/game-sdk (GameModule), @smg/guess-engine (guessModule), ./comments,
 *                 ./rules, ./secrets, ./settings, ./specials, ./state, ./views
 * Used by:        ./index, games/registry
 * Spec:           docs/spec/02-game-guess-the-number.md, docs/spec/04-software-architecture.md §4, §4.7
 */
import type { GameModule } from '@smg/game-sdk';
import { guessModule } from '@smg/guess-engine';
import { z } from 'zod';

import { gtnComments } from './comments.js';
import { GUESS_LIMIT, gtnRules, type GuessAction } from './rules.js';
import { drawSecret, type Secrets } from './secrets.js';
import { gtnSettings, type GtnConfig } from './settings.js';
import { gtnSpecials } from './specials.js';
import { createState, evolveGame, type GtnEvent, type GtnState } from './state.js';
import { reveal, views, viewSchemas } from './views.js';

export const guessTheNumber: GameModule<GtnState, GuessAction, GtnEvent, GtnConfig, Secrets> =
  guessModule({
    meta: {
      id: 'guess-the-number',
      name: 'Guess The Number',
      contractVersion: 1,
      timing: 'cooldown',
      secretModes: ['shared', 'individual'],
      teams: true,
    },
    settings: gtnSettings,
    // A whole number the input takes (DECISIONS T53); whether it is in the range is check 4.
    valueSchema: z.number().int().min(-GUESS_LIMIT).max(GUESS_LIMIT),
    drawSecret,
    createState,
    rules: gtnRules,
    picker: gtnComments,
    evolveGame,
    views,
    viewSchemas,
    specials: gtnSpecials,
    reveal,
  });
