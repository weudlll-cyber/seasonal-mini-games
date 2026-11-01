/**
 * @file   apps/server/src/match/presence.ts
 * @module server/match
 * @brief  Which players have an open connection to which match, right now.
 *
 * Responsibility: the gateway counts each socket that watches a match under its player key;
 *                 the countdown freezes the roster from the players connected at that
 *                 moment (02 §4). Several sockets of one player count once; development bots
 *                 are marked connected while their Quick Test runs.
 * Depends on:     nothing
 * Used by:        ./play, ../realtime/gateway, ../dev/quickTest
 * Spec:           docs/spec/02-game-guess-the-number.md §4 (roster)
 */

export class Presence {
  private readonly counts = new Map<string, Map<string, number>>();

  enter(matchId: string, playerKey: string): void {
    const match = this.counts.get(matchId) ?? new Map<string, number>();
    match.set(playerKey, (match.get(playerKey) ?? 0) + 1);
    this.counts.set(matchId, match);
  }

  leave(matchId: string, playerKey: string): void {
    const match = this.counts.get(matchId);
    const n = match?.get(playerKey) ?? 0;
    if (match === undefined || n === 0) return;
    if (n === 1) match.delete(playerKey);
    else match.set(playerKey, n - 1);
    if (match.size === 0) this.counts.delete(matchId);
  }

  connected(matchId: string): ReadonlySet<string> {
    return new Set(this.counts.get(matchId)?.keys());
  }
}
