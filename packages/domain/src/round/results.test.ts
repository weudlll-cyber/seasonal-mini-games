/**
 * @file   packages/domain/src/round/results.test.ts
 * @module domain/round
 * @brief  Points beyond the places table, teams off, match standings and their tie order.
 *
 * Responsibility: an individual solver after the table gets the further-solver points;
 *                 no team results with teams off; standings sum points, order equal points
 *                 by wins and then by the earliest win, and give fully equal rows one rank.
 * Depends on:     vitest, ./fakes, ./results
 * Spec:           docs/spec/02-game-guess-the-number.md §9 (points); docs/spec/03-seasonal-specials.md §5
 */
import { describe, expect, it } from 'vitest';

import { PickDriver } from './fakes.js';
import { playerResults, scoredPlayers, standings, teamResults } from './results.js';

describe('round results', () => {
  it('give further solvers their points and no team results with teams off', () => {
    const d = new PickDriver({
      secretMode: 'individual',
      points: { sharedWinner: 10, individualPlaces: [5], individualOtherSolver: 2 },
    });
    const t = d.start(['a', 'b', 'c']);
    d.guess('a', 7, t);
    d.guess('b', 7, t + 1);
    expect(playerResults(d.state).map((r) => r.points)).toEqual([5, 2, 0]);
    const off = new PickDriver({ teamsOn: false });
    off.start(['a'], ['red']);
    expect(teamResults(off.state)).toEqual([]);
  });

  it('read a round into standings rows', () => {
    const d = new PickDriver();
    const t = d.start(['a', 'b']);
    d.guess('b', 7, t);
    expect(scoredPlayers(playerResults(d.state))).toEqual([
      { key: 'b', points: 10, won: true, at: t },
      { key: 'a', points: 0, won: false, at: null },
    ]);
  });
});

describe('standings', () => {
  it('sum points and order ties by wins, then by the earliest win', () => {
    const rows = standings([
      { key: 'early', points: 10, won: true, at: 100 },
      { key: 'late', points: 10, won: true, at: 200 },
      { key: 'two', points: 5, won: true, at: 300 },
      { key: 'two', points: 5, won: true, at: 50 },
      { key: 'none', points: 10, won: false, at: null },
      { key: 'zero', points: 0, won: false, at: null },
      { key: 'nil', points: 0, won: false, at: null },
    ]);
    expect(rows.map((r) => [r.key, r.points, r.wins, r.firstWinAt, r.rank])).toEqual([
      ['two', 10, 2, 50, 1],
      ['early', 10, 1, 100, 2],
      ['late', 10, 1, 200, 3],
      ['none', 10, 0, null, 4],
      ['nil', 0, 0, null, 5],
      ['zero', 0, 0, null, 5],
    ]);
  });
});
