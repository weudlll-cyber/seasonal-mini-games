/**
 * @file   load/measure.mjs
 * @module load
 * @brief  What the load check measures: server samples, percentiles, the log's integrity.
 *
 * Responsibility: sample the server's CPU, memory and event-loop lag from /metrics every 2 s;
 *                 percentiles of a list of times; the fairness checks over a round's log
 *                 (every acknowledged guess in the log once under its player, receive numbers
 *                 gap-free, each player's acknowledgements in send order, one winner); the
 *                 specials a round fired, once each, with how late they were.
 * Depends on:     ./http
 * Used by:        ./guessStorm
 * Spec:           docs/spec/09-testing-strategy.md §5 (pass criteria)
 */
import { BASE } from './http.mjs';

// Server samples every 2 s: CPU in cores, resident memory, event-loop lag p99.
export function metricsSampler() {
  const samples = [];
  let last = null;
  const read = async () => {
    const text = await (await fetch(`${BASE}/metrics`)).text();
    const value = (name) =>
      Number(new RegExp(`^${name} ([0-9.e+-]+)$`, 'm').exec(text)?.[1] ?? 'NaN');
    const now = {
      at: Date.now(),
      cpu: value('smg_process_cpu_seconds_total'),
      rss: value('smg_process_resident_memory_bytes'),
      lag: value('smg_nodejs_eventloop_lag_p99_seconds'),
    };
    if (last !== null)
      samples.push({
        cpu: (now.cpu - last.cpu) / ((now.at - last.at) / 1000),
        rss: now.rss,
        lag: now.lag,
      });
    last = now;
  };
  const timer = setInterval(() => void read().catch(() => undefined), 2_000);
  const stop = () => {
    clearInterval(timer);
    const n = Math.max(1, samples.length);
    return {
      cpuPeakCores: Math.max(...samples.map((x) => x.cpu)).toFixed(2),
      cpuMeanCores: (samples.reduce((a, x) => a + x.cpu, 0) / n).toFixed(2),
      rssPeakMiB: Math.round(Math.max(...samples.map((x) => x.rss)) / 1_048_576),
      loopLagP99PeakMs: Math.round(Math.max(...samples.map((x) => x.lag)) * 1000),
    };
  };
  return { read, stop };
}

const pct = (xs, p) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};
export const spread = (xs) => ({
  p50: pct(xs, 50),
  p95: pct(xs, 95),
  p99: pct(xs, 99),
  count: xs.length,
});

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
    lateMs: spread(fired.map((f) => f.lateMs)),
    seenLateMs: spread(fired.map((f) => f.seenLateMs)),
  };
}
