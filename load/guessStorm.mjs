/**
 * @file   load/guessStorm.mjs
 * @module load
 * @brief  Load scenario L1: shared rounds with N players guessing as fast as their cooldown allows.
 *
 * Responsibility: on its own server (./stack: port 3950, a fresh database): raise the match size
 *                 limit for the check, sign in N numbered load players (dev sign-in
 *                 `load-NNNN`) and 100 spectators, let the players join one match and learn
 *                 their player numbers, and spread every client's socket over worker threads
 *                 (./stormWorker) so the driver keeps up with the frames. Then it plays the
 *                 scenario's rounds (./scenarios) one after another in that match, each until
 *                 someone solves it; per round it checks the log through the fairness proof
 *                 (./measure), the specials fired and how late, Frost's delivery, and the
 *                 server's CPU, memory and event-loop lag from /metrics. Afterwards, whatever
 *                 happened, it aborts the match, deletes the load accounts, puts the setting
 *                 back and removes a halving day it added.
 *                 Usage: node load/guessStorm.mjs [players=500] [out.json] [scenario=plain]
 *                 with scenario one of plain, spring, summer, autumn, winter, halving,
 *                 specials, l1.
 * Depends on:     node:worker_threads, node:fs, ./http, ./measure, ./scenarios, ./stack,
 *                 ./stormWorker
 * Spec:           docs/spec/09-testing-strategy.md §5 (L1 shared-500, L4 headroom-1000)
 */
import { writeFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';

import { BASE, ORIGIN, call, inGroups, problems, signIn } from './http.mjs';
import { firedSpecials, integrity, metricsSampler, spread } from './measure.mjs';
import { ROUNDS, SCENARIOS, ensureHalvingDay, removeHalvingDay } from './scenarios.mjs';
import { withLoadStack } from './stack.mjs';

const PLAYERS = Number(process.argv[2] ?? 500);
const OUT = process.argv[3] || null;
const SCENARIO = process.argv[4] ?? 'plain';
const SPECTATORS = 100;
const WORKERS = 6;

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

async function untilEnded(host, roundId) {
  const deadline = Date.now() + 4 * 60_000;
  while (Date.now() < deadline) {
    const s = await call(host, 'GET', `/rounds/${roundId}/state`);
    if (s?.status === 'ended') return s;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return null;
}

// One round of the scenario, played to its end, with its measurements.
async function playRound(ctx, name) {
  const { host, match, workers } = ctx;
  const sampler = metricsSampler();
  await sampler.read();
  const round = await call(host, 'POST', `/matches/${match.code}/rounds`, {
    ...ROUNDS[name],
    startNow: true,
  });
  if (round?.id === undefined) throw new Error(`round ${name} not created`);
  const state = await call(host, 'GET', `/rounds/${round.id}/state`);
  const { opensAt, frostDelayMs } = state;
  for (const w of workers)
    w.worker.postMessage({ t: 'play', roundId: round.id, opensAt, frostDelayMs });
  const ended = await untilEnded(host, round.id);
  const server = sampler.stop();
  const results = await Promise.all(
    workers.map((w) => (w.worker.postMessage({ t: 'stop' }), w.next('record'))),
  );
  const verify = await call(host, 'GET', `/rounds/${round.id}/verify`);
  const records = results.map((r) => r.record);
  const refused = {};
  for (const r of records)
    for (const [k, n] of Object.entries(r.refused)) refused[k] = (refused[k] ?? 0) + n;
  return {
    round: name,
    season: state.season,
    specialOn: state.specialOn,
    halving: state.halving,
    roundS: Math.round(((ended?.endedAt ?? Date.now()) - opensAt) / 1000),
    cooldownAtEndMs: ended?.cooldownMs ?? null,
    ackMs: spread(records.flatMap((r) => r.ack)),
    ownAnswerMs: spread(records.flatMap((r) => r.answer)),
    frostLateMs: frostDelayMs === null ? null : spread(records.flatMap((r) => r.frostLate)),
    specials: firedSpecials(records),
    refused,
    integrity: integrity(records, verify),
    server,
    driverBusiestWorker: Math.max(...results.map((r) => r.busy)).toFixed(2),
    socketProblems: results.reduce((a, r) => a + r.problems.socket, 0),
  };
}

// Load accounts in, joined, each knowing its number in the match (DECISIONS T104).
async function setUp(host) {
  const names = Array.from(
    { length: PLAYERS + SPECTATORS },
    (_, i) => `load-${String(i + 1).padStart(4, '0')}`,
  );
  const clients = await inGroups(names, 9, signIn, 1_000);
  const [players, spectators] = [clients.slice(0, PLAYERS), clients.slice(PLAYERS)];
  const match = await call(host, 'POST', '/matches', {
    gameId: 'guess-the-number',
    title: `load ${SCENARIO} ${String(PLAYERS)}`,
    // The host is a player of their own match too (O16).
    maxPlayers: Math.min(1_000, PLAYERS + 1),
    countsForLeaderboard: false,
  });
  await inGroups(players, 25, async (c) => {
    await call(c, 'POST', `/matches/${match.code}/join`, {});
    c.num = (await call(c, 'GET', `/matches/${match.code}`))?.you ?? null;
  });
  return { match, players, spectators };
}

async function cleanUp(ctx) {
  const { host, admin, match, workers, matchmaking, halvingDay } = ctx;
  for (const w of workers ?? []) await w.worker.terminate();
  if (match !== undefined)
    await call(host, 'POST', `/matches/${match.code}/abort`, { reason: 'load check done' });
  await fetch(`${BASE}/api/v1/dev/load-accounts`, {
    method: 'DELETE',
    headers: { origin: ORIGIN },
  });
  const after = await call(admin, 'GET', '/admin/settings/matchmaking');
  await call(admin, 'PUT', '/admin/settings/matchmaking', {
    version: after.version,
    comment: 'load check done',
    overrides: matchmaking.overrides,
  });
  if (halvingDay !== undefined) await removeHalvingDay(admin, halvingDay);
}

async function main() {
  const rounds = SCENARIOS[SCENARIO];
  if (rounds === undefined) throw new Error(`unknown scenario ${SCENARIO}`);
  const ctx = { host: await signIn('host'), admin: await signIn('admin') };
  // Matches up to 1 000 players need the limit raised (08 §4: default 500, at most 1 000).
  ctx.matchmaking = await call(ctx.admin, 'GET', '/admin/settings/matchmaking');
  await call(ctx.admin, 'PUT', '/admin/settings/matchmaking', {
    version: ctx.matchmaking.version,
    comment: 'load check',
    overrides: { ...ctx.matchmaking.overrides, 'match.maxPlayers': { value: 1_000 } },
  });
  try {
    if (rounds.includes('halving')) ctx.halvingDay = await ensureHalvingDay(ctx.admin);
    const { match, players, spectators } = await setUp(ctx.host);
    ctx.match = match;
    ctx.workers = startWorkers(players, spectators, match.code);
    await Promise.all(
      ctx.workers.map((w) => (w.worker.postMessage({ t: 'connect' }), w.next('ready'))),
    );
    const startedAt = Date.now();
    const played = [];
    for (const name of rounds) played.push(await playRound(ctx, name));
    const summary = {
      scenario: SCENARIO,
      players: PLAYERS,
      spectators: SPECTATORS,
      runS: Math.round((Date.now() - startedAt) / 1000),
      rounds: played,
      problems: { http: problems.http, examples: problems.examples.slice(0, 10) },
    };
    const text = JSON.stringify(summary, null, 2);
    console.log(text);
    if (OUT !== null) writeFileSync(OUT, `${text}\n`);
  } finally {
    await cleanUp(ctx);
  }
}

withLoadStack(main).catch((error) => {
  console.error(error);
  process.exit(1);
});
