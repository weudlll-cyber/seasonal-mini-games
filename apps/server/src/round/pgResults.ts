/**
 * @file   apps/server/src/round/pgResults.ts
 * @module server/round
 * @brief  A round's results, team results and the match standings, written at its end.
 *
 * Responsibility: in the transaction that appends RoundEnded (06 §2.4): one row per roster
 *                 player (a place only for placed players, unique per round), one per team,
 *                 and the match and team standings recomputed over every ended round of the
 *                 match with the domain's tie order (02 §9, 03 §5). A result staff removed
 *                 (smg.round_result_removals, 06 §3.2) is left out: its points, and the team
 *                 point of its team when it was the round's winner; the other players keep
 *                 their places. `refreshMatch` recomputes both after a removal.
 * Depends on:     pg, @smg/domain (results, standings)
 * Used by:        ./pgRoundStore, ../admin/liveRounds
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
  await refreshMatch(c, matchId);
}

export async function refreshMatch(c: pg.PoolClient, matchId: string): Promise<void> {
  await refreshStandings(c, matchId);
  await refreshTeamStandings(c, matchId);
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
     JOIN smg.rounds r ON r.id = rr.round_id WHERE r.match_id = $1
       AND NOT EXISTS (SELECT 1 FROM smg.round_result_removals x
                       WHERE x.round_id = rr.round_id AND x.player_key = rr.player_key)`,
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

// Team standings: 1 point per round win (O12), ties by wins, then by the earliest win (03 §5).
async function refreshTeamStandings(c: pg.PoolClient, matchId: string) {
  const rows = await c.query<{ team: string; points: number; won: boolean; ended_at: Date | null }>(
    `SELECT t.team, CASE WHEN w.removed THEN 0 ELSE t.points END AS points,
            t.won AND NOT w.removed AS won, r.ended_at
     FROM smg.round_team_results t JOIN smg.rounds r ON r.id = t.round_id
     CROSS JOIN LATERAL (SELECT EXISTS (
       SELECT 1 FROM smg.round_result_removals x JOIN smg.round_results rr
         ON rr.round_id = x.round_id AND rr.player_key = x.player_key
       WHERE x.round_id = t.round_id AND rr.team = t.team AND rr.place = 1) AS removed) w
     WHERE r.match_id = $1`,
    [matchId],
  );
  const scores = rows.rows.map((r) => ({
    key: r.team,
    points: r.points,
    won: r.won,
    at: r.ended_at?.getTime() ?? null,
  }));
  await c.query('DELETE FROM smg.match_team_standings WHERE match_id = $1', [matchId]);
  for (const s of standings(scores)) {
    await c.query(
      `INSERT INTO smg.match_team_standings (match_id, team, points, wins, first_win_at, rank)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [matchId, s.key, s.points, s.wins, ts(s.firstWinAt), s.rank],
    );
  }
}
