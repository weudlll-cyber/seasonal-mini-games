/**
 * @file   apps/web/src/live/socket.ts
 * @module web/live
 * @brief  The one game socket of the page, intents with a rising seq, and the server clock.
 *
 * Responsibility: open `/ws` namespace `/play` once (WebSocket only), send intents
 *                 `{ t, seq, data }` and wait for their answer, reconnect with a fresh cookie
 *                 after a sign-in or sign-out, and measure the clock offset with three
 *                 `time.sync` round trips, keeping the shortest (06 §4.1); each sync carries the
 *                 round trip measured before it, which the server keeps as a metric (06 §4.6). The offset is used
 *                 for display only and never sent. Adapted from Bingo's game/socket.ts.
 * Depends on:     socket.io-client, ../shell/http
 * Used by:        ./useMatch, ./useRound, ../shell/session
 * Spec:           docs/spec/06-data-model-api-realtime.md §4.1, §4.3
 */
import { io, type Socket } from 'socket.io-client';

import { BASE_PATH } from '../shell/http.js';

export interface IntentAnswer {
  readonly ok: boolean;
  readonly code?: string;
  readonly data?: unknown;
  readonly until?: number;
  readonly receiveSeq?: number;
  readonly cooldownEndsAt?: number;
}

let socket: Socket | null = null;
let seq = 0;
let offsetMs = 0;

export function gameSocket(): Socket {
  if (socket === null) {
    socket = io('/play', { path: `${BASE_PATH}ws`, transports: ['websocket'] });
    socket.on('connect', () => {
      void syncClock();
    });
  }
  return socket;
}

// Reconnect with the current cookie (after a sign-in or sign-out changed the session).
export function resetSocket(): void {
  socket?.disconnect();
  socket = null;
}

export async function intent(t: string, data: unknown): Promise<IntentAnswer> {
  seq += 1;
  try {
    return (await gameSocket()
      .timeout(5_000)
      .emitWithAck('intent', { t, seq, data })) as IntentAnswer;
  } catch {
    return { ok: false, code: 'NO_ANSWER' };
  }
}

// Server time now, as well as this page can tell it.
export function serverNow(): number {
  return Date.now() + offsetMs;
}

async function syncClock(): Promise<void> {
  let best: { rtt: number; offset: number } | null = null;
  let last: number | undefined;
  for (let i = 0; i < 3; i += 1) {
    const sent = Date.now();
    // The previous round trip goes along: the server keeps it as a metric only.
    const answer = await intent('time.sync', last === undefined ? {} : { rttMs: last });
    const back = Date.now();
    const serverTime = (answer.data as { serverTime?: number } | undefined)?.serverTime;
    if (!answer.ok || serverTime === undefined) continue;
    const rtt = back - sent;
    last = rtt;
    if (best === null || rtt < best.rtt) best = { rtt, offset: serverTime - (sent + back) / 2 };
  }
  if (best !== null) offsetMs = best.offset;
}
