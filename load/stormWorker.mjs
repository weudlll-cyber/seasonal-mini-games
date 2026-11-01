/**
 * @file   load/stormWorker.mjs
 * @module load
 * @brief  One worker thread of the load check: a slice of the sockets, players and spectators.
 *
 * Responsibility: open a socket per client of its slice and watch the match; on "play", let
 *                 each player binary-search its own answers, guessing when its cooldown ends
 *                 plus a pause of 200–1 500 ms (09 §5); record acknowledgement times, the time
 *                 from sending a guess to its own answer, the acknowledged receive numbers and
 *                 the refusals; on "stop", answer with the record and how busy its own event
 *                 loop was (so a saturated driver shows instead of passing for a slow server).
 * Depends on:     socket.io-client, node:worker_threads, node:perf_hooks, ./http
 * Used by:        ./guessStorm
 * Spec:           docs/spec/09-testing-strategy.md §5
 */
import { performance } from 'node:perf_hooks';
import { parentPort, workerData } from 'node:worker_threads';

import { io } from 'socket.io-client';

import { BASE, ORIGIN, problems, fail } from './http.mjs';

const { clients, players, code } = workerData;
const record = { ack: [], answer: [], acked: [], refused: {}, over: false };
let seq = 0;
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

// A player: binary search over its own answers; one guess in flight at a time.
function player(client, socket, roundId) {
  let low = 1;
  let high = 1_000_000;
  let cooldownEndsAt = 0;
  let sentAt = null;
  let done = false;
  socket.on('events', (frame) => {
    if (frame.roundId !== roundId || frame.s !== undefined) return;
    for (const e of frame.events) {
      const g = e.event?.event;
      if (g?.type !== 'FeedbackGiven' || g.playerId !== client.id) continue;
      if (sentAt !== null) record.answer.push(Date.now() - sentAt);
      sentAt = null;
      if (g.feedback === 'higher') low = Math.max(low, g.value + 1);
      else if (g.feedback === 'lower') high = Math.min(high, g.value - 1);
      else done = true;
    }
  });
  const turn = async () => {
    const wait = Math.max(0, cooldownEndsAt - Date.now()) + 200 + Math.floor(Math.random() * 1_300);
    await new Promise((r) => setTimeout(r, wait));
    if (done || record.over) return;
    const sent = Date.now();
    sentAt = sent;
    const ack = await send(socket, 'guess', { roundId, value: Math.floor((low + high) / 2) });
    if (ack.ok) {
      record.ack.push(Date.now() - sent);
      record.acked.push({ player: client.id, receiveSeq: ack.receiveSeq });
      cooldownEndsAt = ack.cooldownEndsAt;
    } else {
      record.refused[ack.code] = (record.refused[ack.code] ?? 0) + 1;
      if (ack.code === 'ROUND_OVER' || ack.code === 'ROUND_NOT_OPEN') record.over = true;
      if (ack.code === 'COOLDOWN_ACTIVE') cooldownEndsAt = ack.until ?? cooldownEndsAt;
    }
    void turn();
  };
  return turn;
}

const sockets = [];
let busySince = null;
parentPort.on('message', async (msg) => {
  if (msg.t === 'connect') {
    for (const c of clients) sockets.push(await connect(c));
    for (const s of sockets) await send(s, 'match.watch', { code });
    parentPort.postMessage({ t: 'ready' });
  } else if (msg.t === 'play') {
    busySince = performance.eventLoopUtilization();
    const start = Math.max(0, msg.opensAt - Date.now());
    setTimeout(() => {
      for (let i = 0; i < players; i += 1) void player(clients[i], sockets[i], msg.roundId)();
    }, start);
  } else if (msg.t === 'stop') {
    record.over = true;
    const busy = performance.eventLoopUtilization(busySince ?? undefined).utilization;
    for (const s of sockets) s.disconnect();
    parentPort.postMessage({ t: 'record', record, problems, busy });
  }
});
