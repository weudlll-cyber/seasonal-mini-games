/**
 * @file   games/mind-games/src/conformance.ts
 * @module games/mind-games
 * @brief  The game's conformance kit: a round input, no secret, and actions from integers.
 *
 * Responsibility: what the platform's conformance suite needs (04 §4.5, 09 §4.2): a round with
 *                 the default settings and All on, so every one of the five choices can be
 *                 accepted; no secret and no marks (P2 holds trivially, 04 §4.8 rule 9); an
 *                 action from any integer over the five choices, with the box ticked or clear.
 * Depends on:     @smg/game-sdk (ConformanceKit), ./choices, ./settings, ./state
 * Used by:        ./index, games/registry
 * Spec:           docs/spec/09-testing-strategy.md §3, §4.2
 */
import type { ConformanceKit } from '@smg/game-sdk';

import { CHOICES } from './choices.js';
import { DEFAULT_CONFIG, type MindConfig } from './settings.js';
import type { MindAction } from './state.js';

export const mindConformance: ConformanceKit<MindAction, MindConfig, null> = {
  input: (_mode, playerIds) => ({
    roundId: 'r-mind',
    roster: playerIds.map((playerId) => ({ playerId, team: null })),
    secretMode: 'shared',
    season: 'winter',
    halving: false,
    config: { ...DEFAULT_CONFIG, allOption: true },
  }),
  sentinels: () => ({ secrets: null, marks: [] }),
  action: (n) => {
    const k = Math.abs(n) % 10;
    return { value: { choice: CHOICES[k % 5] ?? 'spring', hide: k >= 5 } };
  },
};
