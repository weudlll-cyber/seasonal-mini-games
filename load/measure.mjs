/**
 * @file   load/measure.mjs
 * @module load
 * @brief  What the load check measures: server samples and the log's integrity.
 *
 * Responsibility: the server's samples (the kit's watchServer with this game's metric prefix;
 *                 the percentiles of a list of times are the kit's `latencies`, nearest rank,
 *                 kit K73); the fairness checks over a round's log
 *                 (every acknowledged guess in the log once under its player, receive numbers
 *                 gap-free, each player's acknowledgements in send order, one winner); the
 *                 specials a round fired, once each, with how late they were.
 * Depends on:     @seasonal/kit/testing (latencies, watchServer), ./http
 * Used by:        ./storm, ./parallelStorm, ./mindStorm
 * Spec:           docs/spec/09-testing-strategy.md §5 (pass criteria)
 */
import { latencies, watchServer } from '@seasonal/kit/testing';

import { BASE } from './http.mjs';

// The server's CPU, memory and event-loop lag from its /metrics every 2 s; `stop()` sums up.
export const sampleServer = () => watchServer({ url: `${BASE}/metrics`, prefix: 'smg_' });

// Players are named by their number in the match in the log as on the wire (DECISIONS T104).
export function integrity(records, verify) {
  const acked = records.flatMap((r) => r.acked);
  const guesses = (verify?.events ?? []).filter((e) => e.type === 'GuessAccepted');
  const seqs = guesses.map((g) => g.receiveSeq);
  const inLog = new Map(guesses.map((g) => [g.receiveSeq, g.playerId]));
  const byPlayer = new Map();
  for (const a of acked) byPlayer.set(a.player, [...(byPlayer.get(a.player) ?? []), a.receiveSeq]);
  const ended = (verify?.events ?? []).find((e) => e.type === 'RoundEnded');
  return {
    proofOk: verify?.ok === true,
    acceptedInLog: guesses.length,
    acknowledged: acked.length,
    acknowledgedButMissing: acked.filter((a) => inLog.get(a.receiveSeq) !== a.player).length,
    duplicates: seqs.length - new Set(seqs).size,
    gapFree: seqs.every((s, i) => s === i + 1),
    ownOrderKept: [...byPlayer.values()].every((l) =>
      l.every((s, i) => i === 0 || s > (l[i - 1] ?? 0)),
    ),
    winners: (ended?.results ?? []).filter((r) => r.place === 1).length,
    endReason: ended?.reason ?? null,
  };
}

// Each worker's first spectator saw every firing: one entry per special and index.
// `lateMs` is the server's (event time minus due time); `seenLateMs` adds the room frame's
// merge window and the delivery to the socket.
export function firedSpecials(records) {
  const once = new Map();
  for (const f of records.flatMap((r) => r.specials)) once.set(`${f.special}/${f.index}`, f);
  const fired = [...once.values()];
  return {
    fired: fired.map((f) => `${f.special}/${String(f.index)}`),
    lateMs: latencies(fired.map((f) => Math.round(f.lateMs))),
    seenLateMs: latencies(fired.map((f) => Math.round(f.seenLateMs))),
  };
}
