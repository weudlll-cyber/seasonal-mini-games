/**
 * @file   apps/server/test/leagueKit.ts
 * @module server/test
 * @brief  The league tests' shared world: four accounts, won matches, the boards' rows.
 *
 * Responsibility: `useLeague` starts the socket kit and signs the admin in before a file's
 *                 tests and aborts every match they opened afterwards (which also removes
 *                 its points); `wonMatch` plays one shared round of the host with the players,
 *                 won by one of them; `boards` and `rows` read the leaderboards as a player.
 * Depends on:     vitest, ./harness, ./session, ./socketKit
 * Used by:        ./league.integration.test, ./leagueSeasons.integration.test
 * Spec:           docs/spec/09-testing-strategy.md §2
 */
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, expect } from 'vitest';

import { SUITE_TIMEOUT_MS } from './harness.js';
import { signIn, type Client } from './session.js';
import { startSocketKit, type SocketKit, type Who } from './socketKit.js';

export const EVERYONE: readonly Who[] = ['host', 'player-1', 'player-2', 'player-3'];

export interface League {
  kit: SocketKit;
  admin: Client;
  readonly opened: string[];
}

// The kit for one test file: started before its tests, every match it opened aborted after.
export function useLeague(): League {
  const l = { opened: [] as string[] } as unknown as League;
  beforeAll(async () => {
    l.kit = await startSocketKit();
    l.admin = await signIn(l.kit.harness.built.fastify, 'admin');
  }, SUITE_TIMEOUT_MS);
  afterAll(async () => {
    for (const code of l.opened)
      await l.kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
    await l.kit.close();
  });
  return l;
}

export interface Row {
  displayName: string;
  points: number;
  wins: number;
  solves: number;
  matches: number;
  rank: number;
  you: boolean;
}

// A match of the host with the players, all watching; one shared round won by `winner`.
export async function wonMatch(
  l: League,
  players: readonly Who[],
  winner: Who,
  counts = true,
): Promise<string> {
  const { kit } = l;
  const r = await kit.clients.host.post('/api/v1/matches', {
    gameId: 'guess-the-number',
    title: 'league',
    maxPlayers: 10,
    countsForLeaderboard: counts,
  });
  const code = r.json<{ code: string }>().code;
  l.opened.push(code);
  const sockets: Partial<Record<Who, Socket>> = {};
  for (const who of ['host', ...players] as Who[]) {
    if (who !== 'host') await kit.clients[who].post(`/api/v1/matches/${code}/join`, {});
    const s = kit.open(kit.clients[who].cookie);
    expect(await kit.connected(s)).toBe('ok');
    expect((await kit.send(s, 'match.watch', { code })).ok).toBe(true);
    sockets[who] = s;
  }
  const round = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
    settings: { 'round.countdownS': 3 },
    season: 'spring',
    startNow: true,
  });
  const id = round.json<{ id: string }>().id;
  const secrets = await kit.secretsOf(id);
  const secret = secrets.mode === 'shared' ? secrets.value : 0;
  const s = sockets[winner];
  if (s === undefined) throw new Error('the winner watches');
  for (let tries = 0; tries < 80; tries += 1) {
    const answer = await kit.send(s, 'guess', { roundId: id, value: secret });
    if (answer.ok) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  // The result is written with RoundEnded; wait until the round is announced as ended.
  for (let tries = 0; tries < 50; tries += 1) {
    const st = await kit.clients.host.get(`/api/v1/rounds/${id}/state`);
    if (st.json<{ status: string }>().status === 'ended') break;
    await new Promise((done) => setTimeout(done, 100));
  }
  for (const sock of Object.values(sockets)) sock.disconnect();
  return code;
}

export async function boards(l: League) {
  const { kit } = l;
  const list = (await kit.clients['player-1'].get('/api/v1/leaderboards')).json<{
    periods: { id: string; kind: string; name: string }[];
  }>().periods;
  const allTime = list.find((p) => p.kind === 'all_time');
  const season = list.find((p) => p.kind === 'season');
  return { list, allTime, season };
}

export async function rows(l: League, periodId: string, as: Who = 'player-1'): Promise<Row[]> {
  const { kit } = l;
  return (await kit.clients[as].get(`/api/v1/leaderboards/${periodId}`)).json<{ rows: Row[] }>()
    .rows;
}

export const byName = (list: readonly Row[], name: string) =>
  list.find((r) => r.displayName === name);
