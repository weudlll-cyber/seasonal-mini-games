/**
 * @file   load/mindWorker.mjs
 * @module load
 * @brief  One worker thread of load scenario L5: its slice of Mind Games players and spectators.
 *
 * Responsibility: one socket per client, each watching the match; in the round each player
 *                 makes a first choice at a random time inside the join window, then switches to
 *                 another season every 2–2.5 s after its last acknowledgement until play ends
 *                 (09 §5 L5); every acknowledgement's latency; one watcher per worker records the
 *                 room frames' arrival times and every released step's counts and entrants.
 * Depends on:     socket.io-client, ./http
 * Used by:        ./mindStorm
 * Spec:           docs/spec/09-testing-strategy.md §5 (L5)
 */
import { parentPort, workerData } from 'node:worker_threads';

import { io } from 'socket.io-client';

import { BASE, ORIGIN, fail, problems } from './http.mjs';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const { clients, players, code } = workerData;
const sockets = [];
let record = { ack: [], refused: {}, frames: [], steps: [], over: false };
let seq = 0;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (s, t, data) =>
  s
    .timeout(10_000)
    .emitWithAck('intent', { t, seq: (seq += 1), data })
    .catch(() => ({ ok: false, code: 'NO_ANSWER' }));

function connect(client) {
  const socket = io(`${BASE}/play`, {
    path: '/ws',
    transports: ['websocket'],
    extraHeaders: { cookie: client.cookie, origin: ORIGIN },
    reconnection: false,
  });
  return new Promise((resolve) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (e) => {
      fail('socket', e.message);
      resolve(socket);
    });
  });
}

// The room frames as they arrive, and every released step's counts.
function watch(socket, roundId) {
  const rec = record;
  socket.on('events', (frame) => {
    if (frame.roundId !== roundId || frame.s === undefined) return;
    rec.frames.push(Date.now());
    for (const item of frame.events) {
      const e = item.event?.event;
      if (e?.type === 'ChoiceFed')
        rec.steps.push({ s: item.s, counts: e.counts, entrants: e.entrants });
    }
  });
}

// A player: a first choice in the join window, then a switch every 2–2.5 s until play ends.
async function play(socket, roundId, opensAt, plan) {
  const rec = record;
  await pause(Math.max(0, opensAt - Date.now()) + Math.random() * (plan.entryEndMs - 1_000));
  let current = null;
  const end = opensAt + plan.actionsEndMs - 300;
  while (!rec.over && Date.now() < end) {
    const options = SEASONS.filter((s) => s !== current);
    const choice = options[Math.floor(Math.random() * options.length)];
    const sent = Date.now();
    const ack = await send(socket, 'guess', {
      roundId,
      value: { choice, hide: Math.random() < 0.3 },
    });
    if (ack.ok) {
      rec.ack.push(Date.now() - sent);
      current = choice;
    } else rec.refused[ack.code] = (rec.refused[ack.code] ?? 0) + 1;
    await pause(2_000 + Math.random() * 500);
  }
}

parentPort.on('message', async (msg) => {
  if (msg.t === 'connect') {
    for (const c of clients) sockets.push(await connect(c));
    for (const s of sockets) await send(s, 'match.watch', { code });
    parentPort.postMessage({ t: 'ready' });
  } else if (msg.t === 'play') {
    record = { ack: [], refused: {}, frames: [], steps: [], over: false };
    watch(sockets[sockets.length - 1], msg.roundId);
    for (let i = 0; i < players; i++) void play(sockets[i], msg.roundId, msg.opensAt, msg.plan);
  } else if (msg.t === 'stop') {
    record.over = true;
    parentPort.postMessage({ t: 'record', record, problems });
  }
});
