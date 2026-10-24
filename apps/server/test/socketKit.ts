/**
 * @file   apps/server/test/socketKit.ts
 * @module server/test
 * @brief  A listening test server with the realtime gateway, signed-in clients and sockets.
 *
 * Responsibility: start the harness with the gateway and the round runtime and listen on a
 *                 free port; sign in the host and players; open sockets on `/ws`, namespace
 *                 `/play` (with or without a session, from any origin), wait for the
 *                 handshake, send intents with a rising seq, collect every frame a socket
 *                 receives; open a Guess The Number match and let players join; derive a
 *                 running round's secret from its sealed seed, as only the server can, so a
 *                 test can win on purpose; close every socket and the harness at the end.
 *                 Adapted from Bingo's socketKit.ts.
 * Depends on:     socket.io-client, @smg-game/registry, @smg/domain, @smg/game-sdk/crypto,
 *                 ../src/index, ./harness, ./session
 * Used by:        ./rounds.integration.test, ./realtime.integration.test, ./secrets.integration.test
 * Spec:           docs/spec/06-data-model-api-realtime.md §4; docs/spec/09-testing-strategy.md §2
 */
import { GAMES } from '@smg-game/registry';
import { initialRound, roundInput, type RoundEvent } from '@smg/domain';
import { roundRng } from '@smg/game-sdk/crypto';
import { io as connect, type Socket } from 'socket.io-client';

import { attachGateway } from '../src/index.js';
import { startHarness, stopHarness, type Harness } from './harness.js';
import { signIn, type Client } from './session.js';

const gtn = GAMES[0].module;
type Secrets = ReturnType<typeof gtn.deriveSecrets>;

export interface IntentAnswer {
  readonly ok: boolean;
  readonly code?: string;
  readonly data?: unknown;
  readonly receiveSeq?: number;
  readonly cooldownEndsAt?: number;
  readonly until?: number;
}

export type Who = 'host' | 'player-1' | 'player-2' | 'player-3';

export interface SocketKit {
  readonly harness: Harness;
  readonly clients: Record<Who, Client>;
  open(cookie: string | null, origin?: string): Socket;
  connected(socket: Socket): Promise<string>;
  send(socket: Socket, t: string, data: unknown, seq?: number): Promise<IntentAnswer>;
  frames(socket: Socket): unknown[];
  nextSeq(): number;
  // A Guess The Number match of the host with the given players joined.
  openMatch(players: readonly Who[]): Promise<string>;
  accountId(who: Who): Promise<string>;
  secretsOf(roundId: string): Promise<Secrets>;
  close(): Promise<void>;
}

// The secrets of a started round, derived from its sealed seed as the server does.
async function secretsFrom(harness: Harness, roundId: string): Promise<Secrets> {
  const loaded = await harness.built.runtime.store.load(roundId);
  if (loaded === null) throw new Error('no such round');
  const log = loaded.events.map((e) => e.event as RoundEvent<unknown, unknown, never>);
  const created = log.find((e) => e.type === 'RoundCreated');
  const countdown = log.find((e) => e.type === 'CountdownStarted');
  if (created === undefined || countdown === undefined) throw new Error('round not started');
  const input = roundInput(initialRound(created), countdown.roster);
  return gtn.deriveSecrets(input, roundRng(loaded.seed));
}

function connectedOf(s: Socket): Promise<string> {
  return new Promise<string>((resolve) => {
    // A socket opened earlier may have connected already.
    if (s.connected) resolve('ok');
    s.on('connect', () => {
      resolve('ok');
    });
    s.on('connect_error', (e) => {
      resolve(e.message);
    });
  });
}

// Sockets to the gateway, each keeping every frame it receives.
function socketOpener(url: string) {
  const sockets: Socket[] = [];
  const received = new WeakMap<Socket, unknown[]>();
  const open = (cookie: string | null, origin = 'http://localhost:5410') => {
    const headers: Record<string, string> = { origin };
    if (cookie !== null) headers['cookie'] = cookie;
    const s = connect(url, {
      path: '/ws',
      transports: ['websocket'],
      extraHeaders: headers,
      reconnection: false,
    });
    const list: unknown[] = [];
    received.set(s, list);
    s.on('events', (frame: unknown) => list.push(frame));
    sockets.push(s);
    return s;
  };
  return { sockets, open, frames: (s: Socket) => received.get(s) ?? [] };
}

async function listening(harness: Harness) {
  const { built } = harness;
  const io = attachGateway(built.fastify.server, {
    pool: harness.pool,
    play: built.runtime.play,
    limits: built.runtime.limits,
    cookieName: built.cookieName,
    allowedOrigins: ['http://localhost:5410'],
    path: '/ws',
    sessionEnds: built.sessionEnds,
  });
  await built.runtime.start();
  await built.fastify.listen({ host: '127.0.0.1', port: 0 });
  const address = built.fastify.server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  return { io, url: `http://127.0.0.1:${String(port)}/play` };
}

export async function startSocketKit(overrides: Record<string, string> = {}): Promise<SocketKit> {
  const harness = await startHarness(overrides);
  const { io, url } = await listening(harness);
  const app = harness.built.fastify;
  const clients = {
    host: await signIn(app, 'host'),
    'player-1': await signIn(app, 'player-1'),
    'player-2': await signIn(app, 'player-2'),
    'player-3': await signIn(app, 'player-3'),
  };
  const opener = socketOpener(url);
  let seq = 0;
  const nextSeq = (): number => (seq += 1);
  return {
    harness,
    clients,
    open: opener.open,
    connected: connectedOf,
    send: (s, t, data, at = nextSeq()) =>
      s.emitWithAck('intent', { t, seq: at, data }) as Promise<IntentAnswer>,
    frames: opener.frames,
    nextSeq,
    openMatch: async (players) => {
      const r = await clients.host.post('/api/v1/matches', {
        gameId: 'guess-the-number',
        title: 'integration',
        maxPlayers: 10,
      });
      const code = r.json<{ code: string }>().code;
      for (const p of players) await clients[p].post(`/api/v1/matches/${code}/join`, {});
      return code;
    },
    accountId: async (who) => {
      const r = await clients[who].get('/api/v1/session');
      return r.json<{ account: { id: string } }>().account.id;
    },
    secretsOf: (roundId) => secretsFrom(harness, roundId),
    close: async () => {
      for (const s of opener.sockets) s.disconnect();
      await io.close();
      await stopHarness(harness);
    },
  };
}
