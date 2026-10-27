/**
 * @file   apps/server/src/chat/roundLines.ts
 * @module server/chat
 * @brief  One system line in the match's chat room per round end, with the builtin chat only.
 *
 * Responsibility: listens to the rounds' committed events (as the gateway does) and, when a
 *                 round's end reaches the room (under Frost only once it is released, so the
 *                 chat never tells a win before the round view does), writes "Round 4: Walter
 *                 found it first" or "Round 4 ended: nobody found it" into the match's room.
 *                 The line names the winner by display name (bots by their key) and no game
 *                 value: the platform does not know a game's result shape (04 §4). With the
 *                 provider `none` or `hostEmbed` nothing is posted (07 §2). A failure is logged
 *                 and never touches the round.
 * Depends on:     @smg/domain (PlayerResult), ../db/pool, ../match/matches, ../round/rounds, ./chat
 * Used by:        ../http/app
 * Spec:           docs/spec/07-integration.md §2
 */
import type { PlayerResult } from '@smg/domain';

import { displayNames } from '../match/matches.js';
import type { Rounds } from '../round/rounds.js';
import type { Chat } from './chat.js';

export function endLine(index: number, winner: string | null): string {
  return winner === null
    ? `Round ${String(index)} ended: nobody found it`
    : `Round ${String(index)}: ${winner} found it first`;
}

async function post(
  chat: Chat,
  round: { id: string; matchId: string },
  results: readonly PlayerResult[],
) {
  if ((await chat.provider()) !== 'builtin') return;
  const r = await chat.pool.query<{ round_index: number }>(
    'SELECT round_index FROM smg.rounds WHERE id = $1',
    [round.id],
  );
  const winner = results.find((p) => p.place === 1)?.playerId ?? null;
  const name =
    winner === null ? null : ((await displayNames(chat.pool, [winner]))[winner] ?? winner);
  const room = await chat.ofMatch(round.matchId);
  await chat.systemLine(room.id, endLine(r.rows[0]?.round_index ?? 0, name));
}

export function postRoundLines(rounds: Rounds, chat: Chat): void {
  rounds.onCommitted((round, events, how) => {
    for (const stored of events) {
      // A held end (Frost) comes again when it is released, without `held`.
      if (stored.type !== 'RoundEnded' || how.held.has(stored.seq)) continue;
      const results = (stored.event as { results: readonly PlayerResult[] }).results;
      post(chat, round, results).catch((error: unknown) => {
        console.error('[smg] chat round line failed:', error);
      });
    }
  });
}
