/**
 * @file   apps/web/src/live/socket.ts
 * @module web/live
 * @brief  The one game socket of the page, intents with a rising seq, and the server clock.
 *
 * Responsibility: open `/ws` namespace `/play` once (WebSocket only), send intents
 *                 `{ t, seq, data }` and wait for their answer, reconnect with a fresh cookie
 *                 after a sign-in or sign-out, and measure the clock offset with three
 *                 `time.sync` round trips, of which the kit's clockOffset keeps the shortest
 *                 (06 §4.1); each sync carries the round trip measured before it, which the
 *                 server keeps as a metric (06 §4.6). The offset is used for display only and
 *                 never sent: `serverNow`, and `useClockOffset` for the kit's countdowns (null
 *                 until measured). A refused handshake asks GET /session once, so an ended
 *                 website session signs in again (T282). Adapted from Bingo's game/socket.ts.
 * Depends on:     react, socket.io-client, @seasonal/kit (clockOffset), ../shell/http
 * Used by:        ./useMatch, ./useRound, ../shell/session, ../round/*, ../match/SeriesStatus
 * Spec:           docs/spec/06-data-model-api-realtime.md §4.1, §4.3
 */
import { clockOffset, type ClockSample } from '@seasonal/kit';
import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';

import { api, BASE_PATH } from '../shell/http.js';

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
// Server time minus this page's time; null until the first measurement.
let offsetMs: number | null = null;
const offsetListeners = new Set<() => void>();

export function gameSocket(): Socket {
  if (socket === null) {
    socket = io('/play', { path: `${BASE_PATH}ws`, transports: ['websocket'] });
    socket.on('connect', () => {
      void syncClock();
    });
    // The gateway refused the cookie's session: one GET /session, whose answer signs in again
    // through the website when an account's session ended there (../shell/http, T282).
    socket.on('connect_error', (error) => {
      if (error.message === 'UNAUTHORIZED') void api('/session').catch(() => undefined);
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
  return Date.now() + (offsetMs ?? 0);
}

function onOffset(listener: () => void): () => void {
  offsetListeners.add(listener);
  return () => {
    offsetListeners.delete(listener);
  };
}

// The measured offset, re-rendering when it arrives: a countdown shows nothing until then.
export function useClockOffset(): number | null {
  return useSyncExternalStore(onOffset, () => offsetMs);
}

async function syncClock(): Promise<void> {
  const samples: ClockSample[] = [];
  let last: number | undefined;
  for (let i = 0; i < 3; i += 1) {
    const sent = Date.now();
    // The previous round trip goes along: the server keeps it as a metric only.
    const answer = await intent('time.sync', last === undefined ? {} : { rttMs: last });
    const back = Date.now();
    const serverTime = (answer.data as { serverTime?: number } | undefined)?.serverTime;
    if (!answer.ok || serverTime === undefined) continue;
    last = back - sent;
    samples.push({ sentAt: sent, receivedAt: back, serverTime });
  }
  const measured = clockOffset(samples);
  if (measured === null) return;
  offsetMs = measured;
  for (const listener of offsetListeners) listener();
}
