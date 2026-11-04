/**
 * @file   games/bomb-defusal/src/conformance.ts
 * @module games/bomb-defusal
 * @brief  The game's kit for the platform's conformance suite: sentinel sequences and actions.
 *
 * Responsibility: a bomb of 8 wires and 6 cuts. Every action starts with red and every
 *                 sentinel secret does not, so no action ever equals a secret, and each secret
 *                 is a full JSON array (`["purple","orange",…]`) that no view holds unless it
 *                 leaked: the round's wire list starts with red and is 8 long, and no action
 *                 matches. Shared: one fixed order; individual: rotations of the non-red wires,
 *                 one per player. `solve` cuts a player's own sequence, for the check that a
 *                 solved player sees no other secret (O25).
 * Depends on:     @smg/game-sdk (ConformanceKit), @smg/guess-engine (Secrets), ./rules,
 *                 ./settings, ./wires
 * Used by:        ./index, games/registry
 * Spec:           docs/spec/09-testing-strategy.md §3 P2, §4.1 (Bomb Defusal)
 */
import type { ConformanceKit } from '@smg/game-sdk';
import type { Secrets } from '@smg/guess-engine';

import type { GuessAction } from './rules.js';
import type { BdConfig } from './settings.js';
import { PALETTE, type Sequence, type Wire } from './wires.js';

const CUTS = 6;
const NON_RED = PALETTE.filter((w) => w !== 'red');
const SHARED: Sequence = ['purple', 'orange', 'black', 'white', 'green', 'yellow'];

// The non-red wires rotated by `k`, the first CUTS of them.
const rotation = (k: number): Sequence =>
  [...NON_RED.slice(k % NON_RED.length), ...NON_RED.slice(0, k % NON_RED.length)].slice(0, CUTS);

// Red, then five different non-red wires chosen by the digits of `n` in a mixed radix.
function actionSequence(n: number): Sequence {
  let rest = Math.abs(Math.trunc(n));
  const pool: Wire[] = [...NON_RED];
  const out: Wire[] = ['red'];
  while (out.length < CUTS) {
    const i = rest % pool.length;
    rest = Math.floor(rest / pool.length);
    out.push(...pool.splice(i, 1));
  }
  return out;
}

export const bombDefusalConformance: ConformanceKit<GuessAction, BdConfig, Secrets<Sequence>> = {
  input: (mode, playerIds) => ({
    roundId: 'conformance',
    roster: playerIds.map((playerId) => ({ playerId, team: null })),
    secretMode: mode,
    season: 'spring',
    halving: false,
    config: {
      wires: PALETTE.length,
      cuts: CUTS,
      explosionPenaltyS: 5,
      feedbackVisibility: 'full',
      comments: true,
      trendPercent: 33,
      repeatGuessRejected: true,
    },
  }),
  sentinels: (input) => {
    if (input.secretMode === 'shared') {
      return { secrets: { mode: 'shared', value: SHARED }, marks: [JSON.stringify(SHARED)] };
    }
    const byPlayer = Object.fromEntries(input.roster.map((p, k) => [p.playerId, rotation(k)]));
    return {
      secrets: { mode: 'individual', byPlayer },
      marks: Object.values(byPlayer).map((s) => JSON.stringify(s)),
    };
  },
  action: (n) => ({ value: actionSequence(n) }),
  solve: (secrets, playerId) => ({
    value: secrets.mode === 'shared' ? secrets.value : (secrets.byPlayer[playerId] ?? []),
  }),
};
