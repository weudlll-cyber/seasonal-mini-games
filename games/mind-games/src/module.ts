/**
 * @file   games/mind-games/src/module.ts
 * @module games/mind-games
 * @brief  Seasonal Mind Games as one GameModule of the timing class `phased`.
 *
 * Responsibility: put the game's parts (meta, settings, the choice action, state, rules,
 *                 views, the phase plan, the series, the pre-picks and the result rule)
 *                 together behind the contract of 04 §4 and §4.8. The game has no secret, no
 *                 special, no halving and no teams (02e §12): `secretModes` is empty, it
 *                 derives nothing and implements no special hook; its rounds show no season
 *                 (`seasons` false, owner decision O93).
 * Depends on:     @smg/game-sdk (GameModule), ./rules, ./settings, ./state, ./views, ./words
 * Used by:        ./index, games/registry
 * Spec:           docs/spec/02e-game-mind-games.md; docs/spec/04-software-architecture.md §4, §4.8
 */
import type { GameModule } from '@smg/game-sdk';

import { actionSchema, decide, evolve, outcome, prefsSchema, prePick, validate } from './rules.js';
import { mindSettings, planOf, seriesOf, type MindConfig } from './settings.js';
import type { MindAction, MindEvent, MindState } from './state.js';
import { views, viewSchemas } from './views.js';
import { revealOf } from './words.js';

export const mindGames: GameModule<MindState, MindAction, MindEvent, MindConfig, null> = {
  meta: {
    id: 'mind-games',
    name: 'Seasonal Mind Games',
    contractVersion: 1,
    timing: 'phased',
    secretModes: [],
    teams: false,
    // No season shows in the game for now (owner decision O93, 02e §12).
    seasons: false,
  },
  settings: mindSettings,
  actionSchema,
  deriveSecrets: () => null,
  createRound: (input) => ({ cfg: input.config, moves: [] }),
  validate,
  decide,
  evolve,
  views,
  viewSchemas,
  phased: {
    plan: planOf,
    series: seriesOf,
    outcome,
    prefs: { schema: prefsSchema, action: prePick },
  },
  reveal: revealOf,
};
