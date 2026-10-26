/**
 * @file   load/guessStorm.mjs
 * @module load
 * @brief  One shared round with N players guessing as fast as their cooldown allows.
 *
 * Responsibility: against a running development stack (server 3910): raise the match size
 *                 limit for the check, sign in N numbered load players (dev sign-in
 *                 `load-NNNN`) and 100 spectators, let the players join one match, and spread
 *                 every client's socket over worker threads (./stormWorker) so the driver keeps
 *                 up with the frames; start one shared round (cooldown 3 s, range 1–1 000 000)
 *                 and let it run until someone solves it. Then it checks the log through the
 *                 fairness proof (every acknowledged guess is there once, receive numbers are
 *                 gap-free, each player's acknowledgements keep its send order, one winner),
 *                 reads the server's CPU, memory and event-loop lag from /metrics, aborts the
 *                 match, deletes the load accounts and puts the setting back.
 *                 Usage: node load/guessStorm.mjs [players=500] [out.json]
 * Depends on:     node:worker_threads, node:fs, ./http, ./stormWorker
 * Spec:           docs/spec/09-testing-strategy.md §5 (L1 shared-500, L4 headroom-1000)
 */
import { writeFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';

import { BASE, ORIGIN, call, inGroups, problems, signIn } from './http.mjs';

const PLAYERS = Number(process.argv[2] ?? 500);
const OUT = process.argv[3] ?? null;
const SPECTATORS = 100;
const WORKERS = 6;

// Server samples every 2 s: CPU in cores, resident memory, event-loop lag p99.
function metricsSampler() {
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
  return { samples, read, stop: () => clearInterval(timer) };
}

const pct = (xs, p) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};
const spread = (xs) => ({ p50: pct(xs, 50), p95: pct(xs, 95), p99: pct(xs, 99), count: xs.length });

// The worker threads, each with a slice of the clients; players come first in every slice.
function startWorkers(players, spectators, code) {
  return Array.from({ length: WORKERS }, (_, w) => {
    const mine = (list) => list.filter((_, i) => i % WORKERS === w);
    const own = mine(players);
    const worker = new Worker(new URL('./stormWorker.mjs', import.meta.url), {
      workerData: { clients: [...own, ...mine(spectators)], players: own.length, code },
    });
    const next = (t) =>
      new Promise((resolve) => worker.once('message', (m) => m.t === t && resolve(m)));
    return { worker, next };
  });
}

function integrity(records, verify) {
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

async function untilEnded(host, roundId) {
  const deadline = Date.now() + 4 * 60_000;
  while (Date.now() < deadline) {
    const s = await call(host, 'GET', `/rounds/${roundId}/state`);
    if (s?.status === 'ended') return s;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return null;
}

async function main() {
  const host = await signIn('host');
  const admin = await signIn('admin');
  // Matches up to 1 000 players need the limit raised (08 §4: default 500, at most 1 000).
  const doc = await call(admin, 'GET', '/admin/settings/matchmaking');
  const overrides = { ...doc.overrides, 'match.maxPlayers': { value: 1_000 } };
  await call(admin, 'PUT', '/admin/settings/matchmaking', {
    version: doc.version,
    comment: 'load check',
    overrides,
  });
  const names = Array.from(
    { length: PLAYERS + SPECTATORS },
    (_, i) => `load-${String(i + 1).padStart(4, '0')}`,
  );
  const clients = await inGroups(names, 9, signIn, 1_000);
  const [players, spectators] = [clients.slice(0, PLAYERS), clients.slice(PLAYERS)];
  const match = await call(host, 'POST', '/matches', {
    gameId: 'guess-the-number',
    title: `load ${String(PLAYERS)}`,
    maxPlayers: PLAYERS,
    countsForLeaderboard: false,
  });
  await inGroups(players, 25, (c) => call(c, 'POST', `/matches/${match.code}/join`, {}));
  const workers = startWorkers(players, spectators, match.code);
  await Promise.all(workers.map((w) => (w.worker.postMessage({ t: 'connect' }), w.next('ready'))));
  const sampler = metricsSampler();
  await sampler.read();
  const startedAt = Date.now();
  const round = await call(host, 'POST', `/matches/${match.code}/rounds`, {
    season: 'spring',
    startNow: true,
    settings: {
      'round.secretMode': 'shared',
      'round.cooldownS': 3,
      'round.countdownS': 5,
      'round.maxDurationMin': 3,
      'round.rangeLow': 1,
      'round.rangeHigh': 1_000_000,
      'round.specialOn': false,
      'round.teamsOn': false,
    },
  });
  const state = await call(host, 'GET', `/rounds/${round.id}/state`);
  for (const w of workers)
    w.worker.postMessage({ t: 'play', roundId: round.id, opensAt: state.opensAt });
  const ended = await untilEnded(host, round.id);
  sampler.stop();
  const results = await Promise.all(
    workers.map((w) => (w.worker.postMessage({ t: 'stop' }), w.next('record'))),
  );
  for (const w of workers) await w.worker.terminate();
  const verify = await call(host, 'GET', `/rounds/${round.id}/verify`);
  const records = results.map((r) => r.record);
  const refused = {};
  for (const r of records)
    for (const [k, n] of Object.entries(r.refused)) refused[k] = (refused[k] ?? 0) + n;
  const summary = {
    players: PLAYERS,
    spectators: SPECTATORS,
    roundS: Math.round(((ended?.endedAt ?? Date.now()) - state.opensAt) / 1000),
    runS: Math.round((Date.now() - startedAt) / 1000),
    ackMs: spread(records.flatMap((r) => r.ack)),
    ownAnswerMs: spread(records.flatMap((r) => r.answer)),
    refused,
    integrity: integrity(records, verify),
    server: {
      cpuPeakCores: Math.max(...sampler.samples.map((x) => x.cpu)).toFixed(2),
      cpuMeanCores: (
        sampler.samples.reduce((a, x) => a + x.cpu, 0) / Math.max(1, sampler.samples.length)
      ).toFixed(2),
      rssPeakMiB: Math.round(Math.max(...sampler.samples.map((x) => x.rss)) / 1_048_576),
      loopLagP99PeakMs: Math.round(Math.max(...sampler.samples.map((x) => x.lag)) * 1000),
    },
    driverBusiestWorker: Math.max(...results.map((r) => r.busy)).toFixed(2),
    problems: {
      http: problems.http,
      socket: results.reduce((a, r) => a + r.problems.socket, 0),
      examples: [...problems.examples, ...results.flatMap((r) => r.problems.examples)].slice(0, 10),
    },
  };
  await call(host, 'POST', `/matches/${match.code}/abort`, { reason: 'load check done' });
  await fetch(`${BASE}/api/v1/dev/load-accounts`, {
    method: 'DELETE',
    headers: { origin: ORIGIN },
  });
  const after = await call(admin, 'GET', '/admin/settings/matchmaking');
  await call(admin, 'PUT', '/admin/settings/matchmaking', {
    version: after.version,
    comment: 'load check done',
    overrides: doc.overrides,
  });
  const text = JSON.stringify(summary, null, 2);
  console.log(text);
  if (OUT !== null) writeFileSync(OUT, `${text}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
