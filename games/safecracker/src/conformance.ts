/**
 * @file   games/safecracker/src/conformance.ts
 * @module games/safecracker
 * @brief  The game's kit for the platform's conformance suite: sentinel codes and guesses.
 *
 * Responsibility: codes of length 6 with the digits 0–9 (09 §4.1: short digit strings collide
 *                 with times and ids in JSON). The sentinels use only the digits 5–9 —
 *                 `989898` shared, `987xyz` per player, distinct — and every guess of a run
 *                 only the digits 0–4, so no guess holds or borders a sentinel, every answer
 *                 is 0 right place, 0 wrong place, and integers that map to the same code give
 *                 a repeat. A leaked secret is then the only way a mark can appear in a view
 *                 or event. `solve` tries a player's own code (O25).
 * Depends on:     @smg/game-sdk (ConformanceKit), @smg/guess-engine (Secrets), ./rules,
 *                 ./settings
 * Used by:        ./index, games/registry
 * Spec:           docs/spec/09-testing-strategy.md §3 P2, §4.1
 */
import type { ConformanceKit } from '@smg/game-sdk';
import type { Secrets } from '@smg/guess-engine';

import type { GuessAction } from './rules.js';
import type { ScConfig } from './settings.js';

const LENGTH = 6;
const SHARED = '989898';

// The k-th player's code: digits 5–9 only, distinct for up to 125 players.
function individual(k: number): string {
  const tail = [Math.floor(k / 25) % 5, Math.floor(k / 5) % 5, k % 5].map((d) => String(5 + d));
  return `987${tail.join('')}`;
}

export const scConformance: ConformanceKit<GuessAction, ScConfig, Secrets<string>> = {
  input: (mode, playerIds) => ({
    roundId: 'conformance',
    roster: playerIds.map((playerId) => ({ playerId, team: null })),
    secretMode: mode,
    season: 'spring',
    halving: false,
    config: {
      codeLength: LENGTH,
      codeDigits: 10,
      digitsPerFall: 1,
      feedbackVisibility: 'full',
      comments: true,
      trendPercent: 33,
      repeatGuessRejected: true,
    },
  }),
  sentinels: (input) => {
    if (input.secretMode === 'shared') {
      return { secrets: { mode: 'shared', value: SHARED }, marks: [SHARED] };
    }
    const byPlayer = Object.fromEntries(input.roster.map((p, k) => [p.playerId, individual(k)]));
    return { secrets: { mode: 'individual', byPlayer }, marks: Object.values(byPlayer) };
  },
  // |n| written in base 5 over six places: a code of the digits 0–4.
  action: (n) => {
    let rest = Math.abs(Math.trunc(n)) % 5 ** LENGTH;
    let value = '';
    for (let i = 0; i < LENGTH; i += 1) {
      value = String(rest % 5) + value;
      rest = Math.floor(rest / 5);
    }
    return { value };
  },
  solve: (secrets, playerId) => ({
    value: secrets.mode === 'shared' ? secrets.value : (secrets.byPlayer[playerId] ?? SHARED),
  }),
};
