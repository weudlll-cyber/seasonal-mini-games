/**
 * @file   load/stormWorker.mjs
 * @module load
 * @brief  One worker thread of the load check: a slice of the sockets, players and spectators.
 *
 * Responsibility: open a socket per client of its slice and watch the match; on "play" for a
 *                 round, let each player binary-search its own answers inside what the room
 *                 learnt (a halved range, fallen numbers), guessing once its cooldown has
 *                 ended and its last answer arrived, plus a pause of 200–1 500 ms (09 §5);
 *                 record acknowledgement times, the time from a guess to its own answer, how
 *                 much later than due Frost delivered it, the acknowledged receive numbers,
 *                 the refusals, and through the slice's first spectator every special fired;
 *                 on "stop", answer with the round's record and how busy its own event loop
 *                 was (so a saturated driver shows instead of passing for a slow server); the
 *                 sockets stay for the next round until the thread is terminated.
 * Depends on:     socket.io-client, node:worker_threads, node:perf_hooks, ./http
 * Used by:        ./guessStorm
 * Spec:           docs/spec/09-testing-strategy.md §5; docs/spec/03-seasonal-specials.md §2, §4
 */
import { performance } from 'node:perf_hooks';
import { parentPort, workerData } from 'node:worker_threads';

import { io } from 'socket.io-client';

import { BASE, ORIGIN, problems, fail } from './http.mjs';

const { clients, players, code } = workerData;
const fresh = () => ({
  ack: [],
  answer: [],
  frostLate: [],
  specials: [],
  acked: [],
  refused: {},
  over: false,
});
let record = fresh();
let seq = 0;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (s, t, data) =>
  s
    .timeout(10_000)
    .emitWithAck('intent', { t, seq: (seq += 1), data })
    .catch(() => ({ ok: false, code: 'NO_ANSWER' }));

// One frame handler per socket, swapped per round (null: the socket only watches).
const sockets = [];
const handlers = [];

function connect(client, i) {
  const socket = io(`${BASE}/play`, {
    path: '/ws',
    transports: ['websocket'],
    extraHeaders: { cookie: client.cookie, origin: ORIGIN },
    reconnection: false,
  });
  socket.on('events', (frame) => handlers[i]?.(frame));
  return new Promise((resolve) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (e) => {
      fail('socket', e.message);
      resolve(socket);
    });
  });
}

// Room frames carry `s`; a special's frame item has the server's time beside the due time.
function specialsWatcher(roundId) {
  const rec = record;
  return (frame) => {
    if (frame.roundId !== roundId || frame.s === undefined) return;
    for (const item of frame.events) {
      const e = item.event;
      if (e?.type !== 'SpecialFired') continue;
      const lateMs = item.at - e.at;
      rec.specials.push({
        special: e.special,
        index: e.index,
        lateMs,
        seenLateMs: Date.now() - e.at,
      });
    }
  };
}

// What the room learnt narrows every player's search: a halved shared range, fallen numbers.
function roomEvent(s, g) {
  if (g?.type === 'RangeHalved' && g.playerId === null) {
    s.low = Math.max(s.low, g.range.low);
    s.high = Math.min(s.high, g.range.high);
  } else if (g?.type === 'NumbersRemoved') for (const n of g.numbers) s.removed.add(n);
}

function ownAnswer(s, item, frostDelayMs) {
  const g = item.event?.event;
  if (g?.type !== 'FeedbackGiven' || g.playerId !== s.num) return;
  if (s.sentAt !== null) s.rec.answer.push(Date.now() - s.sentAt);
  // Frost holds an answer until its receive time plus the delay (03 §2.4).
  if (frostDelayMs !== null) s.rec.frostLate.push(Date.now() - (item.at + frostDelayMs));
  s.sentAt = null;
  if (g.feedback === 'higher') s.low = Math.max(s.low, g.value + 1);
  else if (g.feedback === 'lower') s.high = Math.min(s.high, g.value - 1);
  else s.done = true;
  s.answered?.();
}

// The middle of the window, or the nearest number to it that has not fallen.
function pick(s) {
  const mid = Math.floor((s.low + s.high) / 2);
  for (let k = 0; k <= s.high - s.low; k += 1) {
    if (mid + k <= s.high && !s.removed.has(mid + k)) return mid + k;
    if (mid - k >= s.low && !s.removed.has(mid - k)) return mid - k;
  }
  return mid;
}

// A player: one guess at a time, the next only after the last one's answer arrived. It
// writes to the record of its own round, so a turn still pending from the last round cannot
// touch the next one's.
function player(i, roundId, frostDelayMs) {
  const socket = sockets[i];
  const rec = record;
  const s = { rec, num: clients[i].num, low: 1, high: 1_000_000, removed: new Set() };
  Object.assign(s, { cooldownEndsAt: 0, sentAt: null, done: false, answered: null });
  handlers[i] = (frame) => {
    if (frame.roundId !== roundId) return;
    for (const item of frame.events) {
      if (frame.s !== undefined) roomEvent(s, item.event?.event);
      else ownAnswer(s, item, frostDelayMs);
    }
  };
  const turn = async () => {
    await pause(
      Math.max(0, s.cooldownEndsAt - Date.now()) + 200 + Math.floor(Math.random() * 1_300),
    );
    if (s.done || rec.over) return;
    const value = pick(s);
    const sent = Date.now();
    s.sentAt = sent;
    const answered = new Promise((r) => (s.answered = r));
    const ack = await send(socket, 'guess', { roundId, value });
    if (ack.ok) {
      rec.ack.push(Date.now() - sent);
      rec.acked.push({ player: s.num, receiveSeq: ack.receiveSeq });
      s.cooldownEndsAt = ack.cooldownEndsAt;
      await Promise.race([answered, pause(15_000)]);
    } else {
      s.sentAt = null;
      rec.refused[ack.code] = (rec.refused[ack.code] ?? 0) + 1;
      if (ack.code === 'ROUND_OVER' || ack.code === 'ROUND_NOT_OPEN') rec.over = true;
      if (ack.code === 'COOLDOWN_ACTIVE') s.cooldownEndsAt = ack.until ?? s.cooldownEndsAt;
      if (ack.code === 'NUMBER_REMOVED') s.removed.add(value);
    }
    void turn();
  };
  return turn;
}

let busySince = null;
parentPort.on('message', async (msg) => {
  if (msg.t === 'connect') {
    for (const [i, c] of clients.entries()) sockets.push(await connect(c, i));
    for (const s of sockets) await send(s, 'match.watch', { code });
    parentPort.postMessage({ t: 'ready' });
  } else if (msg.t === 'play') {
    record = fresh();
    busySince = performance.eventLoopUtilization();
    handlers[Math.min(players, clients.length - 1)] = specialsWatcher(msg.roundId);
    const turns = Array.from({ length: players }, (_, i) =>
      player(i, msg.roundId, msg.frostDelayMs),
    );
    setTimeout(() => turns.forEach((turn) => void turn()), Math.max(0, msg.opensAt - Date.now()));
  } else if (msg.t === 'stop') {
    record.over = true;
    handlers.fill(null);
    const busy = performance.eventLoopUtilization(busySince ?? undefined).utilization;
    parentPort.postMessage({ t: 'record', record, problems, busy });
  }
});
