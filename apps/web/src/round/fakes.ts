/**
 * @file   apps/web/src/round/fakes.ts
 * @module web/round
 * @brief  A finished round's view for the round components' tests; the window's size.
 *
 * Responsibility: one shared round won by Walter with Anna 0.4 s behind, both teams, the
 *                 placings, the proof's seed and the names; tests derive open and individual
 *                 rounds from it. `viewport` sets the window's size for the round's layout.
 * Depends on:     @smg/contracts (RoundStateView)
 * Used by:        the round components' tests
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
  inactivityLimitMs: 60_000,
  inactivityWarnMs: 30_000,
  endReason: 'solved',
  abortReason: null,
  winner: 'w',
  margin: { playerId: 'a', ms: 400 },
  roster: [
    {
      playerKey: 'w',
      team: 'autumn',
      guesses: 9,
      cooldownEndsAt: 0,
      place: 1,
      solved: true,
      timedOut: false,
    },
    {
      playerKey: 'a',
      team: 'winter',
      guesses: 4,
      cooldownEndsAt: 20_000,
      place: null,
      solved: false,
      timedOut: false,
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
      timedOut: false,
    },
    {
      playerId: 'a',
      place: null,
      solved: false,
      solveAt: null,
      guesses: 4,
      team: 'winter',
      points: 0,
      timedOut: false,
    },
  ],
  teams: [
    { team: 'autumn', members: 1, points: 1, won: true },
    { team: 'winter', members: 1, points: 0, won: false },
  ],
  seed: 'cd'.repeat(32),
  names: { w: 'Walter', a: 'Anna' },
  ownInactivity: null,
};

// The window's size for the round's layout (./useRoundView): jsdom starts at 1024 × 768, a
// desktop; a test that sets a phone puts the desktop back afterwards.
export function viewport(width: number, height: number): void {
  Object.assign(window, { innerWidth: width, innerHeight: height });
  window.dispatchEvent(new Event('resize'));
}
