/**
 * @file   apps/web/src/round/fakes.ts
 * @module web/round
 * @brief  A finished round's view for the round components' tests.
 *
 * Responsibility: one shared round won by Walter with Anna 0.4 s behind, both teams, the
 *                 placings, the proof's seed and the names; tests derive open and individual
 *                 rounds from it.
 * Depends on:     @smg/contracts (RoundStateView)
 * Used by:        ./round.test, ./result.test
 * Spec:           docs/spec/09-testing-strategy.md §2
 */
import type { RoundStateView } from '@smg/contracts';

export const ended: RoundStateView = {
  roundId: 'r1',
  status: 'ended',
  season: 'autumn',
  secretMode: 'shared',
  teamsOn: true,
  specialOn: true,
  halving: false,
  frostDelayMs: null,
  commitment: 'ab'.repeat(32),
  opensAt: 0,
  endsAt: 600_000,
  endedAt: 9_000,
  cooldownMs: 3_000,
  endReason: 'solved',
  abortReason: null,
  winner: 'w',
  margin: { playerId: 'a', ms: 400 },
  roster: [
    { playerKey: 'w', team: 'autumn', guesses: 9, cooldownEndsAt: 0, place: 1, solved: true },
    {
      playerKey: 'a',
      team: 'winter',
      guesses: 4,
      cooldownEndsAt: 20_000,
      place: null,
      solved: false,
    },
  ],
  seq: 30,
  role: 'result',
  game: null,
  results: [
    {
      playerId: 'w',
      place: 1,
      solved: true,
      solveAt: 9_000,
      guesses: 9,
      team: 'autumn',
      points: 10,
    },
    {
      playerId: 'a',
      place: null,
      solved: false,
      solveAt: null,
      guesses: 4,
      team: 'winter',
      points: 0,
    },
  ],
  teams: [
    { team: 'autumn', members: 1, points: 1, won: true },
    { team: 'winter', members: 1, points: 0, won: false },
  ],
  seed: 'cd'.repeat(32),
  names: { w: 'Walter', a: 'Anna' },
};
