/**
 * @file   apps/server/src/chat/roundLines.ts
 * @module server/chat
 * @brief  One system line in the match's chat room per round end, with the builtin chat only.
 *
 * Responsibility: listens to the rounds' committed events (as the gateway does) and, when a
 *                 round's end reaches the room (under Frost only once it is released, so the
 *                 chat never tells a win before the round view does), writes "Round 4: Walter
 *                 found it first — the number was 42" or "Round 4 ended: nobody found it — the
 *                 number was 42" into the match's room. The line names the winner by display
 *                 name (bots by their key) and the secret in the game's own words (its
 *                 optional `reveal` hook, O32): the platform does not know a game's result
 *                 shape (04 §4); a game without the hook, or a round no longer in memory,
 *                 gets the line without it. A phased round (04 §4.8) has no first place: its
 *                 winners are the rows with `won`, and its line is the game's words, "Round 3:
 *                 Winter was the least chosen (3 players)." or "Round 3 ended: nobody won."
 *                 (02e §9; DECISIONS T325). With the
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

// What won a phased round (02e §9): the game's words ("Winter was the least chosen (3
// players)"), else the count of its winners; null when nobody won. Also the match summary's
// (../match/summary, T333).
export function phasedWords(winners: number, words: string | null): string | null {
  if (winners === 0) return null;
  return words ?? `${String(winners)} ${winners === 1 ? 'player' : 'players'} won`;
}

// A phased round's line: its winners come from `won`, not a first place.
export function phasedEndLine(index: number, winners: number, words: string | null): string {
  const won = phasedWords(winners, words);
  return won === null
    ? `Round ${String(index)} ended: nobody won.`
    : `Round ${String(index)}: ${won}.`;
}

export function endLine(index: number, winner: string | null, secret: string | null): string {
  const line =
    winner === null
      ? `Round ${String(index)} ended: nobody found it`
      : `Round ${String(index)}: ${winner} found it first`;
  return secret === null ? line : `${line} — ${secret}`;
}

// The line of one round: a phased round's from `won` (its results carry it, 04 §4.8 rule 6; a
// guess game's never do), a guess round's from its first place.
async function lineOf(
  chat: Chat,
  round: { id: string; index: number },
  results: readonly PlayerResult[],
  rounds: Rounds,
): Promise<string> {
  if (results.some((p) => p.won !== undefined)) {
    const winners = results.filter((p) => p.won === true).length;
    return phasedEndLine(round.index, winners, rounds.peek(round.id)?.reveal(null) ?? null);
  }
  const winner = results.find((p) => p.place === 1)?.playerId ?? null;
  const name =
    winner === null ? null : ((await displayNames(chat.pool, [winner]))[winner] ?? winner);
  // The round is still in memory when its end commits; the result view names the secret.
  const secret = rounds.peek(round.id)?.reveal(winner) ?? null;
  return endLine(round.index, name, secret);
}

async function post(
  chat: Chat,
  round: { id: string; matchId: string },
  results: readonly PlayerResult[],
  rounds: Rounds,
) {
  if ((await chat.provider()) !== 'builtin') return;
  const r = await chat.pool.query<{ round_index: number }>(
    'SELECT round_index FROM smg.rounds WHERE id = $1',
    [round.id],
  );
  const index = r.rows[0]?.round_index ?? 0;
  const line = await lineOf(chat, { id: round.id, index }, results, rounds);
  const room = await chat.ofMatch(round.matchId);
  await chat.systemLine(room.id, line);
}

export function postRoundLines(rounds: Rounds, chat: Chat): void {
  rounds.onCommitted((round, events, how) => {
    for (const stored of events) {
      // A held end (Frost) comes again when it is released, without `held`.
      if (stored.type !== 'RoundEnded' || how.held.has(stored.seq)) continue;
      const results = (stored.event as { results: readonly PlayerResult[] }).results;
      post(chat, round, results, rounds).catch((error: unknown) => {
        console.error('[smg] chat round line failed:', error);
      });
    }
  });
}
