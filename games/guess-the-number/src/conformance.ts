/**
 * @file   games/guess-the-number/src/conformance.ts
 * @module games/guess-the-number
 * @brief  The game's kit for the platform's conformance suite: sentinel secrets and guesses.
 *
 * Responsibility: a range of 1–1 000 000 with secrets at 777 777 (shared) or 900 001 + k
 *                 (individual), and guesses from 1 to 600 000, so no guess hits or borders a
 *                 secret and no answer narrows a band onto one; a leaked secret is then the
 *                 only way its digits can appear in a view or event.
 * Depends on:     @smg/game-sdk (ConformanceKit), ./rules, ./secrets, ./settings
 * Used by:        ./index, games/registry
 * Spec:           docs/spec/09-testing-strategy.md §3 P2
 */
import type { ConformanceKit } from '@smg/game-sdk';

import type { GuessAction } from './rules.js';
import type { Secrets } from './secrets.js';
import type { GtnConfig } from './settings.js';

const SHARED = 777_777;
const FIRST_INDIVIDUAL = 900_001;

export const gtnConformance: ConformanceKit<GuessAction, GtnConfig, Secrets> = {
  input: (mode, playerIds) => ({
    roundId: 'conformance',
    roster: playerIds.map((playerId) => ({ playerId, team: null })),
    secretMode: mode,
    season: 'spring',
    halving: false,
    config: {
      rangeLow: 1,
      rangeHigh: 1_000_000,
      feedbackVisibility: 'full',
      repeatGuessRejected: true,
    },
  }),
  sentinels: (input) => {
    if (input.secretMode === 'shared') {
      return { secrets: { mode: 'shared', value: SHARED }, marks: [String(SHARED)] };
    }
    const byPlayer = Object.fromEntries(
      input.roster.map((p, k) => [p.playerId, FIRST_INDIVIDUAL + k]),
    );
    return {
      secrets: { mode: 'individual', byPlayer },
      marks: Object.values(byPlayer).map(String),
    };
  },
  action: (n) => ({ value: 1 + (Math.abs(Math.trunc(n)) % 600_000) }),
};
