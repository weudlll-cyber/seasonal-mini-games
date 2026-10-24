/**
 * @file   apps/server/src/round/pgResults.ts
 * @module server/round
 * @brief  A round's results, team results and the match standings, written at its end.
 *
 * Responsibility: in the transaction that appends RoundEnded (06 §2.4): one row per roster
 *                 player (a place only for placed players, unique per round), one per team,
 *                 and the match standings recomputed over every ended round of the match with
 *                 the domain's tie order (02 §9).
 * Depends on:     pg, @smg/domain (results, standings)
 * Used by:        ./pgRoundStore
 * Spec:           docs/spec/06-data-model-api-realtime.md §2.4, §2.5; docs/spec/02-game-guess-the-number.md §9
 */
import { scoredPlayers, standings, type PlayerResult, type TeamResult } from '@smg/domain';
import type pg from 'pg';

// Milliseconds as an ISO time for timestamptz columns; null stays null.
export const ts = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

export async function writeResults(
  c: pg.PoolClient,
  roundId: string,
  matchId: string,
  ended: { readonly results: readonly PlayerResult[]; readonly teams: readonly TeamResult[] },
) {
  for (const r of ended.results) {
    await c.query(
      `INSERT INTO smg.round_results (round_id, player_key, place, solved, solve_receive_seq, solve_at,
         guesses, team, points) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        roundId,
        r.playerId,
        r.place,
        r.solved,
        r.solveSeq,
        ts(r.solveAt),
        r.guesses,
        r.team,
        r.points,
      ],
    );
  }
  for (const t of ended.teams) {
    await c.query(
      'INSERT INTO smg.round_team_results (round_id, team, members, points, won) VALUES ($1, $2, $3, $4, $5)',
      [roundId, t.team, t.members, t.points, t.won],
    );
  }
  await refreshStandings(c, matchId);
}

// Match standings over every ended round of the match (06 §2.5), recomputed in full.
async function refreshStandings(c: pg.PoolClient, matchId: string) {
  const rows = await c.query<{
    player_key: string;
    place: number | null;
    points: number;
    solve_at: Date | null;
  }>(
    `SELECT rr.player_key, rr.place, rr.points, rr.solve_at FROM smg.round_results rr
     JOIN smg.rounds r ON r.id = rr.round_id WHERE r.match_id = $1`,
    [matchId],
  );
  const results: PlayerResult[] = rows.rows.map((r) => ({
    playerId: r.player_key,
    place: r.place,
    solved: r.solve_at !== null,
    solveSeq: null,
    solveAt: r.solve_at?.getTime() ?? null,
    guesses: 0,
    team: null,
    points: r.points,
  }));
  await c.query('DELETE FROM smg.match_standings WHERE match_id = $1', [matchId]);
  for (const s of standings(scoredPlayers(results))) {
    await c.query(
      `INSERT INTO smg.match_standings (match_id, player_key, points, wins, first_win_at, rank)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [matchId, s.key, s.points, s.wins, ts(s.firstWinAt), s.rank],
    );
  }
}
