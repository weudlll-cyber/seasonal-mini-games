/**
 * @file   apps/server/src/match/teams.ts
 * @module server/match
 * @brief  Season teams per match: the choice, the lock after a player's first round, placement.
 *
 * Responsibility: a player picks a season team once and keeps it for the whole match (O26):
 *                 the team is locked once the player was on the roster of a started round of
 *                 the match (its `CountdownStarted` event names them). A roster player without
 *                 a team is placed in the match's smallest team when their first round starts;
 *                 ties between teams are broken by a hash of the round id and the player key,
 *                 so anyone can recompute the placement (DECISIONS T82). The placed team is
 *                 then stored and fixed like a chosen one.
 * Depends on:     node:crypto, @smg/game-sdk (RosterPlayer), ../db/pool, ./matches (types)
 * Used by:        ./play
 * Spec:           docs/spec/02-game-guess-the-number.md §2; docs/spec/03-seasonal-specials.md §5
 */
import { createHash } from 'node:crypto';

import type { RosterPlayer } from '@smg/game-sdk';

import type { DbPool } from '../db/pool.js';
import type { PlayerRow, Team } from './matches.js';

const TEAMS: readonly Team[] = ['spring', 'summer', 'autumn', 'winter'];

export async function setTeam(
  pool: DbPool,
  matchId: string,
  playerKey: string,
  team: Team,
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE smg.match_players SET team = $3, team_chosen_at = now()
     WHERE match_id = $1 AND player_key = $2 AND state = 'active'`,
    [matchId, playerKey, team],
  );
  return r.rowCount === 1;
}

// Whether the player was on the roster of a started round of this match (O26).
export async function teamLocked(pool: DbPool, matchId: string, playerKey: string) {
  const r = await pool.query(
    `SELECT 1 FROM smg.round_events e JOIN smg.rounds r ON r.id = e.round_id
     WHERE r.match_id = $1 AND e.type = 'CountdownStarted' AND e.payload->'roster' @> $2::jsonb
     LIMIT 1`,
    [matchId, JSON.stringify([{ playerId: playerKey }])],
  );
  return r.rowCount === 1;
}

// The roster with every player's match team: the stored one, or the smallest team of the
// match counted over its players with a team (O26). `placed` are the new placements.
export function placeTeams(
  roster: readonly RosterPlayer[],
  players: readonly PlayerRow[],
  roundId: string,
): { roster: RosterPlayer[]; placed: { playerKey: string; team: Team }[] } {
  const stored = new Map(players.map((p) => [p.playerKey, p.team]));
  const size = new Map<Team, number>(TEAMS.map((t) => [t, 0]));
  for (const p of players) if (p.team !== null) size.set(p.team, (size.get(p.team) ?? 0) + 1);
  const placed: { playerKey: string; team: Team }[] = [];
  const out = roster.map((p) => {
    const team = stored.get(p.playerId) ?? (p.team as Team | null);
    if (team !== null) return { ...p, team };
    const least = Math.min(...size.values());
    const smallest = TEAMS.filter((t) => size.get(t) === least);
    const pick = smallest[tieBreak(roundId, p.playerId, smallest.length)] ?? 'spring';
    size.set(pick, least + 1);
    placed.push({ playerKey: p.playerId, team: pick });
    return { ...p, team: pick };
  });
  return { roster: out, placed };
}

// An index below `n` from a hash of the round id and the player key (T82).
function tieBreak(roundId: string, playerKey: string, n: number): number {
  const digest = createHash('sha256').update(`teams:${roundId}:${playerKey}`).digest();
  return digest.readUInt32BE(0) % n;
}

// Stores placed teams; a team the player chose meanwhile is kept.
export async function fixTeams(
  pool: DbPool,
  matchId: string,
  placed: readonly { playerKey: string; team: Team }[],
): Promise<void> {
  for (const p of placed) {
    await pool.query(
      `UPDATE smg.match_players SET team = $3, team_chosen_at = now()
       WHERE match_id = $1 AND player_key = $2 AND team IS NULL`,
      [matchId, p.playerKey, p.team],
    );
  }
}
