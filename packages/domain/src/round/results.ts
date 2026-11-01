/**
 * @file   packages/domain/src/round/results.ts
 * @module domain/round
 * @brief  Placings, points and team results of a round; match standings over rounds.
 *
 * Responsibility: the owner's rules for what a round gives (O11, O12): shared mode places only
 *                 the winner, individual mode places solvers in solve order and lists the
 *                 rest as "not solved"; points from the frozen table; 1 team point to the
 *                 winner's team. Match standings sum the points, ties ordered by wins and
 *                 then by the earliest win.
 * Depends on:     @smg/game-sdk (points table), ./types
 * Used by:        ./step (RoundEnded), ../index, apps/server (standings projection)
 * Spec:           docs/spec/02-game-guess-the-number.md §8, §9; docs/spec/03-seasonal-specials.md §5
 */
import type { PointsTable } from '@smg/game-sdk';

import type { PlayerResult, RoundState, TeamResult } from './types.js';

function pointsFor(place: number | null, shared: boolean, table: PointsTable): number {
  if (place === null) return 0;
  if (shared) return place === 1 ? table.sharedWinner : 0;
  return table.individualPlaces[place - 1] ?? table.individualOtherSolver;
}

// Placed players first, by place; then everyone else in roster order.
export function playerResults<S, Cfg>(state: RoundState<S, Cfg>): PlayerResult[] {
  const shared = state.config.secretMode === 'shared';
  const rows = Object.entries(state.roster).map(([playerId, e]) => ({
    playerId,
    place: e.place,
    solved: e.solvedSeq !== null,
    solveSeq: e.solvedSeq,
    solveAt: e.solvedAt,
    guesses: e.guesses,
    team: e.team,
    points: pointsFor(e.place, shared, state.config.points),
  }));
  const placed = rows
    .filter((r) => r.place !== null)
    .sort((a, b) => (a.place ?? 0) - (b.place ?? 0));
  return [...placed, ...rows.filter((r) => r.place === null)];
}

// Season teams play in shared mode only; the winner's team scores 1 (O12).
export function teamResults<S, Cfg>(state: RoundState<S, Cfg>): TeamResult[] {
  if (state.config.secretMode !== 'shared' || !state.config.teamsOn) return [];
  const members = new Map<string, number>();
  for (const e of Object.values(state.roster)) {
    if (e.team !== null) members.set(e.team, (members.get(e.team) ?? 0) + 1);
  }
  const winnerTeam = state.winner === null ? null : (state.roster[state.winner]?.team ?? null);
  return [...members.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([team, n]) => ({
      team,
      members: n,
      won: team === winnerTeam,
      points: team === winnerTeam ? 1 : 0,
    }));
}

export interface StandingRow {
  readonly key: string;
  readonly points: number;
  readonly wins: number;
  readonly firstWinAt: number | null;
  readonly rank: number;
}

export interface Scored {
  readonly key: string;
  readonly points: number;
  readonly won: boolean;
  readonly at: number | null;
}

// Sums per key; equal points are ordered by wins, then by the earliest win. Keys equal on
// all three share a rank (1, 1, 3); the key itself only fixes the listing order.
export function standings(scores: readonly Scored[]): StandingRow[] {
  const rows = new Map<string, { points: number; wins: number; firstWinAt: number | null }>();
  for (const s of scores) {
    const row = rows.get(s.key) ?? { points: 0, wins: 0, firstWinAt: null };
    row.points += s.points;
    if (s.won && s.at !== null) {
      row.wins += 1;
      row.firstWinAt = row.firstWinAt === null ? s.at : Math.min(row.firstWinAt, s.at);
    }
    rows.set(s.key, row);
  }
  const cmp = (a: Omit<StandingRow, 'rank'>, b: Omit<StandingRow, 'rank'>) =>
    b.points - a.points || b.wins - a.wins || earlier(a.firstWinAt, b.firstWinAt);
  const sorted = [...rows.entries()]
    .map(([key, r]) => ({ key, ...r }))
    .sort((a, b) => cmp(a, b) || (a.key < b.key ? -1 : 1));
  return sorted.map((r, i) => {
    const firstEqual = sorted.findIndex((o) => cmp(o, r) === 0);
    return { ...r, rank: (firstEqual === -1 ? i : firstEqual) + 1 };
  });
}

// Negative when a won first; a key without a win comes after one with a win.
function earlier(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

// One round's contribution to the match standings.
export function scoredPlayers(results: readonly PlayerResult[]): Scored[] {
  return results.map((r) => ({
    key: r.playerId,
    points: r.points,
    won: r.place === 1,
    at: r.solveAt,
  }));
}
