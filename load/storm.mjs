/**
 * @file   load/storm.mjs
 * @module load
 * @brief  What the guess drivers share: load accounts, a joined match, worker threads, one round.
 *
 * Responsibility: sign in numbered load accounts (`load-NNNN`); let players join a match and
 *                 learn their player numbers; raise the match size limit for the check and put
 *                 it back; spread a match's sockets over worker threads (./stormWorker); play one
 *                 round to its end and measure it (acknowledgements, own answers, Frost's
 *                 lateness, the specials fired, the log's integrity through the fairness proof,
 *                 the server's CPU, memory and event-loop lag); remove the load accounts.
 * Depends on:     node:worker_threads, ./http, ./measure
 * Used by:        ./guessStorm (L1, L2, L4), ./parallelStorm (L3)
 * Spec:           docs/spec/09-testing-strategy.md §5
 */
import { Worker } from 'node:worker_threads';

import { BASE, ORIGIN, call, inGroups, signIn } from './http.mjs';
import { firedSpecials, integrity, metricsSampler, spread } from './measure.mjs';

// `count` load accounts from number `from` on (load-0001 …), signed in in paced groups.
export function signInLoad(from, count) {
  const names = Array.from(
    { length: count },
    (_, i) => `load-${String(from + i + 1).padStart(4, '0')}`,
  );
  return inGroups(names, 9, signIn, 1_000);
}

// A Guess The Number match of the host's, joined by the players, each knowing its number in
// the match (DECISIONS T104).
export async function joinedMatch(host, players, title) {
  const match = await call(host, 'POST', '/matches', {
    gameId: 'guess-the-number',
    title,
    // The host is a player of their own match too (O16).
    maxPlayers: Math.min(1_000, players.length + 1),
    countsForLeaderboard: false,
  });
  await inGroups(players, 25, async (c) => {
    await call(c, 'POST', `/matches/${match.code}/join`, {});
    c.num = (await call(c, 'GET', `/matches/${match.code}`))?.you ?? null;
  });
  return match;
}

// Matches up to 1 000 players need the limit raised (08 §4: default 500, at most 1 000);
// returns the settings as they were, for `restoreLimit`.
export async function raiseLimit(admin) {
  const before = await call(admin, 'GET', '/admin/settings/matchmaking');
  await call(admin, 'PUT', '/admin/settings/matchmaking', {
    version: before.version,
    comment: 'load check',
    overrides: { ...before.overrides, 'match.maxPlayers': { value: 1_000 } },
  });
  return before;
}

export async function restoreLimit(admin, before) {
  const after = await call(admin, 'GET', '/admin/settings/matchmaking');
  await call(admin, 'PUT', '/admin/settings/matchmaking', {
    version: after.version,
    comment: 'load check done',
    overrides: before.overrides,
  });
}

export function deleteLoadAccounts() {
  return fetch(`${BASE}/api/v1/dev/load-accounts`, {
    method: 'DELETE',
    headers: { origin: ORIGIN },
  });
}

// `count` worker threads with a slice of the match's clients each; players come first in
// every slice.
export function startWorkers(players, spectators, code, count) {
  return Array.from({ length: count }, (_, w) => {
    const mine = (list) => list.filter((_, i) => i % count === w);
    const own = mine(players);
    const worker = new Worker(new URL('./stormWorker.mjs', import.meta.url), {
      workerData: { clients: [...own, ...mine(spectators)], players: own.length, code },
    });
    const next = (t) =>
      new Promise((resolve) => worker.once('message', (m) => m.t === t && resolve(m)));
    return { worker, next };
  });
}

export async function connectWorkers(workers) {
  await Promise.all(workers.map((w) => (w.worker.postMessage({ t: 'connect' }), w.next('ready'))));
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

// One round in the context's match, played to its end, with its measurements. `round` is the
// host's settings (./scenarios ROUNDS); `burst` sends every player's first guess within 50 ms
// of the open (L2). With `sampler: false` the caller samples the server itself, and with
// `acks` the result keeps every acknowledgement time, to spread several rounds together (L3).
export async function playRound(ctx, name, round, opts = {}) {
  const { burst = false, sampler = true, acks = false } = opts;
  const { host, match, workers } = ctx;
  const metrics = sampler ? metricsSampler() : null;
  await metrics?.read();
  const created = await call(host, 'POST', `/matches/${match.code}/rounds`, {
    ...round,
    startNow: true,
  });
  if (created?.id === undefined) throw new Error(`round ${name} not created`);
  const state = await call(host, 'GET', `/rounds/${created.id}/state`);
  const { opensAt, frostDelayMs } = state;
  for (const w of workers)
    w.worker.postMessage({ t: 'play', roundId: created.id, opensAt, frostDelayMs, burst });
  const ended = await untilEnded(host, created.id);
  const server = metrics?.stop() ?? null;
  const results = await Promise.all(
    workers.map((w) => (w.worker.postMessage({ t: 'stop' }), w.next('record'))),
  );
  const verify = await call(host, 'GET', `/rounds/${created.id}/verify`);
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
    ...(acks ? { acks: records.flatMap((r) => r.ack) } : {}),
  };
}
