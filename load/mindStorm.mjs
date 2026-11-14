/**
 * @file   load/mindStorm.mjs
 * @module load
 * @brief  Load scenario L5 `mind-500`: one Seasonal Mind Games round, 500 players, 100 spectators.
 *
 * Responsibility: 09 §5 L5 on its own server (./stack: port 3950, a fresh database): load accounts signed in and
 *                 joined to a Mind Games match, one round with the defaults 120/30/60 (the season
 *                 picked by hand), each player switching up to every 2 s until play ends
 *                 (./mindWorker); then the acknowledgement's spread (p95 < 150 ms), the release
 *                 tick's distance from a whole second between consecutive room frames (p95 <
 *                 150 ms), and the released counts: each step's counts add up to its entrants,
 *                 and the last step's equal the result's (from the log). Usage: `node
 *                 mindStorm.mjs [players] [out.json]`. Not a gate: run once, numbers reported.
 * Depends on:     node:worker_threads, ./http, ./measure, ./stack
 * Spec:           docs/spec/09-testing-strategy.md §5 (L5)
 */
import { writeFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';

import { BASE, ORIGIN, call, inGroups, problems, signIn } from './http.mjs';
import { metricsSampler, spread } from './measure.mjs';
import { withLoadStack } from './stack.mjs';

const PLAYERS = Number(process.argv[2] ?? 500);
const OUT = process.argv[3] || null;
const SPECTATORS = 100;
const WORKERS = 6;
const CHOICES = ['spring', 'summer', 'autumn', 'winter', 'all'];

function startWorkers(players, spectators, code) {
  return Array.from({ length: WORKERS }, (_, w) => {
    const mine = (list) => list.filter((_, i) => i % WORKERS === w);
    const own = mine(players);
    const worker = new Worker(new URL('./mindWorker.mjs', import.meta.url), {
      workerData: { clients: [...own, ...mine(spectators)], players: own.length, code },
    });
    const next = (t) => new Promise((r) => worker.once('message', (m) => m.t === t && r(m)));
    return { worker, next };
  });
}

async function untilEnded(host, roundId) {
  for (const deadline = Date.now() + 5 * 60_000; Date.now() < deadline;) {
    const s = await call(host, 'GET', `/rounds/${roundId}/state`);
    if (s?.status === 'ended') return s;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return null;
}

// How far each gap between room frames lies from a whole number of seconds.
const tickOff = (times) =>
  times.slice(1).map((t, i) => {
    const gap = t - (times[i] ?? t);
    return Math.abs(gap - Math.round(gap / 1_000) * 1_000);
  });

function released(records, result) {
  const steps = records.flatMap((r) => r.steps).sort((a, b) => a.s - b.s);
  const sums = steps.filter((x) => CHOICES.reduce((n, c) => n + x.counts[c], 0) !== x.entrants);
  const last = steps.at(-1)?.counts ?? null;
  const final = result?.game?.counts ?? null;
  return {
    steps: steps.length,
    stepsNotAddingUp: sums.length,
    lastEqualsResult: last !== null && JSON.stringify(last) === JSON.stringify(final),
  };
}

async function setUp(host) {
  const names = Array.from(
    { length: PLAYERS + SPECTATORS },
    (_, i) => `load-${String(i + 1).padStart(4, '0')}`,
  );
  const clients = await inGroups(names, 9, signIn, 1_000);
  const [players, spectators] = [clients.slice(0, PLAYERS), clients.slice(PLAYERS)];
  const match = await call(host, 'POST', '/matches', {
    gameId: 'mind-games',
    title: `load mind ${String(PLAYERS)}`,
    maxPlayers: Math.min(1_000, PLAYERS + 1),
    countsForLeaderboard: false,
  });
  await inGroups(players, 25, (c) => call(c, 'POST', `/matches/${match.code}/join`, {}));
  return { match, players, spectators };
}

async function playRound(ctx) {
  const sampler = metricsSampler();
  await sampler.read();
  const round = await call(ctx.host, 'POST', `/matches/${ctx.match.code}/rounds`, {
    season: 'winter',
    settings: { 'round.seasonSource': 'manual', 'round.countdownS': 5 },
    startNow: true,
  });
  const state = await call(ctx.host, 'GET', `/rounds/${round.id}/state`);
  for (const w of ctx.workers)
    w.worker.postMessage({
      t: 'play',
      roundId: round.id,
      opensAt: state.opensAt,
      plan: state.plan,
    });
  await untilEnded(ctx.host, round.id);
  const server = sampler.stop();
  const records = (
    await Promise.all(
      ctx.workers.map((w) => (w.worker.postMessage({ t: 'stop' }), w.next('record'))),
    )
  ).map((r) => r.record);
  const result = await call(ctx.host, 'GET', `/rounds/${round.id}/state`);
  const refused = {};
  for (const r of records)
    for (const [k, n] of Object.entries(r.refused)) refused[k] = (refused[k] ?? 0) + n;
  return {
    ackMs: spread(records.flatMap((r) => r.ack)),
    tickOffMs: spread(records.flatMap((r) => tickOff(r.frames))),
    released: released(records, result),
    refused,
    server,
  };
}

async function main() {
  const ctx = { host: await signIn('host'), admin: await signIn('admin') };
  const mm = await call(ctx.admin, 'GET', '/admin/settings/matchmaking');
  await call(ctx.admin, 'PUT', '/admin/settings/matchmaking', {
    version: mm.version,
    comment: 'load check',
    overrides: { ...mm.overrides, 'match.maxPlayers': { value: 1_000 } },
  });
  try {
    const { match, players, spectators } = await setUp(ctx.host);
    ctx.match = match;
    ctx.workers = startWorkers(players, spectators, match.code);
    await Promise.all(
      ctx.workers.map((w) => (w.worker.postMessage({ t: 'connect' }), w.next('ready'))),
    );
    const summary = {
      scenario: 'mind-500',
      players: PLAYERS,
      spectators: SPECTATORS,
      ...(await playRound(ctx)),
    };
    summary.problems = { http: problems.http, examples: problems.examples.slice(0, 10) };
    const text = JSON.stringify(summary, null, 2);
    if (OUT !== null) writeFileSync(OUT, text);
    console.log(text);
  } finally {
    for (const w of ctx.workers ?? []) await w.worker.terminate();
    if (ctx.match !== undefined)
      await call(ctx.host, 'POST', `/matches/${ctx.match.code}/abort`, {
        reason: 'load check done',
      });
    await fetch(`${BASE}/api/v1/dev/load-accounts`, {
      method: 'DELETE',
      headers: { origin: ORIGIN },
    });
    const after = await call(ctx.admin, 'GET', '/admin/settings/matchmaking');
    await call(ctx.admin, 'PUT', '/admin/settings/matchmaking', {
      version: after.version,
      comment: 'load check done',
      overrides: mm.overrides,
    });
  }
}

await withLoadStack(main);
