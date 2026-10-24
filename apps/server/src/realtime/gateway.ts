/**
 * @file   apps/server/src/realtime/gateway.ts
 * @module server/realtime
 * @brief  Socket.IO gateway: authenticated sockets, match rooms, frames out, intents in (06 §4).
 *
 * Responsibility: one endpoint (`/ws` under the base path), namespace `/play`, WebSocket only.
 *                 The handshake checks the Origin and loads the session from the cookie; a
 *                 socket whose session ends is closed. Every intent's envelope, replay number
 *                 and socket limit are checked the moment it is read; a guess then goes into
 *                 its round's queue at once, with nothing awaited in between, so the queue
 *                 order is the read order across all sockets (04 §5.2); other intents run one
 *                 after another per socket (./inOrder). Committed round events go out as
 *                 frames `{ roundId, s, events }`: the public form to `match:<id>`, a player's
 *                 own events to `match:<id>:player:<key>`, host events to `match:<id>:host`.
 *                 Adapted from Bingo's gateway.ts.
 * Depends on:     socket.io, node:http, ../auth/*, ../match/*, ../round/*, ./intents, ./inOrder
 * Used by:        ../main, test/*
 * Spec:           docs/spec/06-data-model-api-realtime.md §4; docs/spec/04-software-architecture.md §5.2
 */
import type { Server as HttpServer } from 'node:http';

import { Server, type Socket } from 'socket.io';

import type { SessionEnds } from '../auth/sessionEnds.js';
import { findSession, type Session } from '../auth/sessions.js';
import type { DbPool } from '../db/pool.js';
import type { Play } from '../match/play.js';
import type { GuessLimits } from '../round/guessLimits.js';
import { inOrder } from './inOrder.js';
import {
  envelopeOf,
  guessIntent,
  handleIntent,
  type IntentContext,
  type IntentType,
} from './intents.js';

export interface GatewayDeps {
  readonly pool: DbPool;
  readonly play: Play;
  readonly limits: GuessLimits;
  readonly cookieName: string;
  readonly allowedOrigins: readonly string[];
  // "/ws" standalone, "/games/mini-games/ws" behind the website.
  readonly path: string;
  readonly sessionEnds: SessionEnds;
}

export interface SocketData {
  session: Session;
  lastSeq: number;
  // Watched matches: match id → the player key this socket counts as there (or null).
  rooms: Map<string, string | null>;
}

type Ack = (answer: unknown) => void;

export function attachGateway(server: HttpServer, deps: GatewayDeps): Server {
  const io = new Server(server, {
    path: deps.path,
    transports: ['websocket'],
    maxHttpBufferSize: 16 * 1024,
    pingInterval: 20_000,
    pingTimeout: 20_000,
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60_000, skipMiddlewares: false },
  });
  const play = io.of('/play');
  deps.sessionEnds.onEnd((ids) => {
    for (const id of ids) play.in(`session:${id}`).disconnectSockets(true);
  });
  play.use((socket, next) => {
    authenticate(socket, deps)
      .then((session) => {
        (socket.data as SocketData) = { session, lastSeq: 0, rooms: new Map() };
        next();
      })
      .catch((error: unknown) => {
        next(error instanceof Error ? error : new Error('UNAUTHORIZED'));
      });
  });
  play.on('connection', (socket) => {
    connect(socket, deps);
  });
  deps.play.rounds.onCommitted((round, events, how) => {
    const frames = round.frames(events, how.held);
    const s = events.at(-1)?.seq ?? 0;
    // Released Frost events repeat earlier seqs: `late` tells the client they are no gap.
    const room = { roundId: round.id, s, events: frames.room, ...(how.late ? { late: true } : {}) };
    play.to(`match:${round.matchId}`).emit('events', room);
    for (const [key, own] of frames.players) {
      play
        .to(`match:${round.matchId}:player:${key}`)
        .emit('events', { roundId: round.id, events: own });
    }
    if (frames.host.length > 0) {
      play
        .to(`match:${round.matchId}:host`)
        .emit('events', { roundId: round.id, events: frames.host });
    }
  });
  deps.play.onMatchChanged((matchId) => {
    play.to(`match:${matchId}`).emit('match', { matchId });
  });
  return io;
}

function connect(socket: Socket, deps: GatewayDeps): void {
  const ctx: IntentContext = { socket, data: socket.data as SocketData, deps };
  void socket.join(`session:${ctx.data.session.id}`);
  const later = inOrder(async (t: Exclude<IntentType, 'guess'>, data: unknown, ack?: Ack) => {
    const answer = await handleIntent(ctx, t, data).catch((error: unknown) => {
      console.error('[smg] intent failed:', error);
      return { ok: false, code: 'INTERNAL' };
    });
    ack?.(answer);
  });
  socket.on('intent', (raw: unknown, ack?: Ack) => {
    const read = envelopeOf(ctx, raw);
    if (!read.ok) {
      ack?.(read);
      return;
    }
    if (read.t === 'guess') {
      // Queued now, answered after its batch committed (04 §5.2, §5.3).
      void guessIntent(ctx, read.data).then((answer) => ack?.(answer));
      return;
    }
    void later(read.t, read.data, ack);
  });
  socket.on('disconnect', () => {
    for (const [matchId, key] of ctx.data.rooms)
      if (key !== null) deps.play.presence.leave(matchId, key);
    ctx.data.rooms.clear();
  });
}

async function authenticate(socket: Socket, deps: GatewayDeps): Promise<Session> {
  const origin = socket.handshake.headers.origin;
  if (origin === undefined || !deps.allowedOrigins.includes(origin))
    throw new Error('ORIGIN_NOT_ALLOWED');
  const token = cookieValue(socket.handshake.headers.cookie, deps.cookieName);
  const session = token === null ? null : await findSession(deps.pool, token);
  if (session === null) throw new Error('UNAUTHORIZED');
  return session;
}

function cookieValue(header: string | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}
