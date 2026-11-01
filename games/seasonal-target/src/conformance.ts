/**
 * @file   games/seasonal-target/src/conformance.ts
 * @module games/seasonal-target
 * @brief  The game's kit for the platform's conformance suite: sentinel targets and guesses.
 *
 * Responsibility: a 100 × 100 map with the shared target at (97, 95) or player k's at
 *                 (91 + k mod 9, 91 + ⌊k / 9⌋ mod 9), and guesses over columns 1–80 and every
 *                 row, so no guess hits or touches a target; a leaked target is then the only
 *                 way its pair `"x":97,"y":95` can appear in a view or event. `solve` guesses a
 *                 player's own target, for the check that a solved player sees no other (O25).
 * Depends on:     @smg/game-sdk (ConformanceKit), ./rules, ./secrets, ./settings
 * Used by:        ./index, games/registry
 * Spec:           docs/spec/09-testing-strategy.md §3 P2, §4.1
 */
import type { ConformanceKit } from '@smg/game-sdk';

import type { Cell } from './geometry.js';
import type { GuessAction } from './rules.js';
import { cellOf, ruleOf, type Secrets, type Target } from './secrets.js';
import type { StConfig } from './settings.js';

const CONFIG: StConfig = {
  width: 100,
  height: 100,
  feedback: 'direction',
  feedbackVisibility: 'full',
  comments: true,
  trendPercent: 33,
  repeatGuessRejected: true,
  autumnMinCellsLeft: 10,
  halvingMinCells: 16,
};

const target = (c: Cell): Target => ({ ...c, rule: ruleOf(CONFIG) });

// The JSON pair a leaked cell would show in any view or event.
const mark = (c: Cell): string => `"x":${String(c.x)},"y":${String(c.y)}`;

export const stConformance: ConformanceKit<GuessAction, StConfig, Secrets> = {
  input: (mode, playerIds) => ({
    roundId: 'conformance',
    roster: playerIds.map((playerId) => ({ playerId, team: null })),
    secretMode: mode,
    season: 'spring',
    halving: false,
    config: CONFIG,
  }),
  sentinels: (input) => {
    if (input.secretMode === 'shared') {
      const cell = { x: 97, y: 95 };
      return { secrets: { mode: 'shared', value: target(cell) }, marks: [mark(cell)] };
    }
    const cells = input.roster.map((p, k) => ({
      id: p.playerId,
      cell: { x: 91 + (k % 9), y: 91 + (Math.floor(k / 9) % 9) },
    }));
    return {
      secrets: {
        mode: 'individual',
        byPlayer: Object.fromEntries(cells.map((c) => [c.id, target(c.cell)])),
      },
      marks: cells.map((c) => mark(c.cell)),
    };
  },
  action: (n) => {
    const k = Math.abs(Math.trunc(n));
    return { value: { x: 1 + (k % 80), y: 1 + (Math.floor(k / 80) % 100) } };
  },
  solve: (secrets, playerId) => {
    const own = secrets.mode === 'shared' ? secrets.value : secrets.byPlayer[playerId];
    return { value: own === undefined ? { x: 1, y: 1 } : cellOf(own) };
  },
};
