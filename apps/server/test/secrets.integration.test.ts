/**
 * @file   apps/server/test/secrets.integration.test.ts
 * @module server/test
 * @brief  No secret of a running round reaches anyone; the Quick Test; who may do what.
 *
 * Responsibility: S2 / 09 §6 secret scan: in a running individual round with 1–1 000 000,
 *                 every frame each socket received (players, host, a spectator), every
 *                 acknowledgement and every HTTP answer (state for each viewer, match summary
 *                 and lists, the admin API) is searched for each secret as a number or a whole
 *                 word, with guesses that never touch a secret or its neighbours; after the
 *                 end the result shows them. The Quick Test runs a real round against bots to
 *                 its end, and the same seed text gives the same season and secret. Hosts,
 *                 players and guests are held to their permissions.
 * Depends on:     vitest, ./socketKit, ./harness
 * Spec:           docs/spec/05-security-threat-model.md §3; docs/spec/09-testing-strategy.md §3 P2, §6;
 *                 docs/spec/11-roadmap.md (Quick Test)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SUITE_TIMEOUT_MS } from './harness.js';
import { signIn } from './session.js';
import { startSocketKit, type SocketKit, type Who } from './socketKit.js';

let kit: SocketKit;
const opened: string[] = [];

beforeAll(async () => {
  kit = await startSocketKit();
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  for (const code of opened)
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  await kit.close();
});

// Every number equal to a secret, and every string holding one as a whole word.
function leaks(value: unknown, secrets: readonly number[]): string[] {
  const found: string[] = [];
  const words = secrets.map((n) => new RegExp(`\b${String(n)}\b`));
  const walk = (v: unknown, path: string): void => {
    if (typeof v === 'number' && secrets.includes(v)) found.push(`${path}=${String(v)}`);
    else if (typeof v === 'string' && words.some((w) => w.test(v))) found.push(`${path}="${v}"`);
    else if (Array.isArray(v)) for (const [i, x] of v.entries()) walk(x, `${path}[${String(i)}]`);
    else if (v !== null && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    }
  };
  walk(value, '$');
  return found;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PLAYERS: Who[] = ['player-1', 'player-2'];
const WATCHERS = ['host', 'player-1', 'player-2', 'player-3'] as const;

async function watched(code: string) {
  const sockets = WATCHERS.map((w) => ({ w, s: kit.open(kit.clients[w].cookie) }));
  for (const { s } of sockets) {
    expect(await kit.connected(s)).toBe('ok');
    expect((await kit.send(s, 'match.watch', { code })).ok).toBe(true);
  }
  return sockets;
}

// Two guesses per player that never touch a secret or its neighbours.
async function guessAround(
  sockets: Awaited<ReturnType<typeof watched>>,
  id: string,
  secrets: number[],
) {
  const safe = (v: number) => secrets.every((n) => Math.abs(n - v) > 1);
  const acks: unknown[] = [];
  for (let k = 0; k < 2; k += 1) {
    for (const [i, p] of PLAYERS.entries()) {
      let value = 1 + 499_999 * ((k + i) % 2) + 7 * k + i;
      while (!safe(value)) value += 3;
      const s = sockets.find((x) => x.w === p)?.s;
      if (s !== undefined) acks.push(await kit.send(s, 'guess', { roundId: id, value }));
    }
    await sleep(3_050);
  }
  return acks;
}

// Every HTTP answer a viewer of the match can get, and the admin API.
async function answers(id: string, code: string) {
  const http: unknown[] = [];
  for (const w of WATCHERS) {
    const c = kit.clients[w];
    for (const url of [
      `/api/v1/rounds/${id}/state`,
      `/api/v1/matches/${code}`,
      '/api/v1/me/matches',
    ]) {
      http.push((await c.get(url)).json<unknown>());
    }
  }
  http.push((await kit.clients.host.get('/api/v1/matches')).json<unknown>());
  const admin = await signIn(kit.harness.built.fastify, 'admin');
  for (const url of [
    '/api/v1/admin/audit',
    '/api/v1/admin/abuse',
    '/api/v1/admin/settings/game.guess-the-number',
  ]) {
    http.push((await admin.get(url)).json<unknown>());
  }
  return http;
}

describe('secrets of a running round', () => {
  it('appear in no frame, acknowledgement or HTTP answer until the end (S2)', async () => {
    const code = await kit.openMatch(PLAYERS);
    opened.push(code);
    const sockets = await watched(code);
    const created = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
      settings: {
        'round.secretMode': 'individual',
        'round.cooldownS': 3,
        'round.countdownS': 3,
        'round.rangeLow': 1,
        'round.rangeHigh': 1_000_000,
      },
      season: 'winter',
      startNow: true,
    });
    const id = created.json<{ id: string }>().id;
    const sec = await kit.secretsOf(id);
    const secrets = sec.mode === 'individual' ? Object.values(sec.byPlayer) : [sec.value];
    await sleep(3_100);
    const acks = await guessAround(sockets, id, secrets);
    const http = await answers(id, code);
    expect(acks.every((x) => (x as { ok: boolean }).ok)).toBe(true);
    const frames = sockets.map(({ s }) => kit.frames(s));
    expect(frames.flat().length).toBeGreaterThan(0);
    expect(leaks({ frames, acks, http }, secrets)).toEqual([]);
    const end = await kit.clients.host.post(`/api/v1/rounds/${id}/end`, {});
    expect(end.statusCode).toBe(200);
    const result = (
      await kit.clients['player-3'].get(`/api/v1/rounds/${id}/result`)
    ).json<unknown>();
    expect(leaks(result, secrets).length).toBeGreaterThanOrEqual(secrets.length);
  }, 60_000);
});

interface Started {
  readonly roundId: string;
  readonly matchCode: string;
  readonly season: string;
}

describe('the Quick Test', () => {
  it('plays a round against bots to its end, the same seed giving the same round', async () => {
    const player = kit.clients['player-3'];
    const body = { bots: 2, rangeHigh: 10, cooldownS: 3, seedText: 'meadow' };
    const first = (await player.post('/api/v1/dev/quicktest', body)).json<Started>();
    opened.push(first.matchCode);
    const end = Date.now() + 50_000;
    let status = '';
    while (status !== 'ended' && Date.now() < end) {
      await sleep(500);
      const state = await player.get(`/api/v1/rounds/${first.roundId}/state`);
      status = state.json<{ status: string }>().status;
    }
    expect(status).toBe('ended');
    const again = (await player.post('/api/v1/dev/quicktest', body)).json<Started>();
    opened.push(again.matchCode);
    expect(again.season).toBe(first.season);
    expect(await kit.secretsOf(again.roundId)).toEqual(await kit.secretsOf(first.roundId));
  }, 90_000);
});

describe('permissions', () => {
  it('keep rounds to their host and guesses to signed-in roster players', async () => {
    const code = await kit.openMatch(['player-1']);
    opened.push(code);
    const rounds = `/api/v1/matches/${code}/rounds`;
    expect((await kit.clients['player-1'].post(rounds, { season: 'spring' })).statusCode).toBe(403);
    const id = (await kit.clients.host.post(rounds, { season: 'spring' })).json<{ id: string }>()
      .id;
    for (const path of ['start', 'end']) {
      const r = await kit.clients['player-1'].post(`/api/v1/rounds/${id}/${path}`, {});
      expect(r.statusCode).toBe(403);
    }
    const app = kit.harness.built.fastify;
    const anonymous = await app.inject({ method: 'GET', url: `/api/v1/rounds/${id}/state` });
    expect(anonymous.statusCode).toBe(401);
    const early = await kit.clients['player-2'].post(`/api/v1/rounds/${id}/guesses`, { value: 5 });
    expect(early.json<unknown>()).toMatchObject({ code: 'ROUND_NOT_OPEN' });
    const tooSlow = { season: 'spring', settings: { 'round.cooldownS': 99 } };
    expect((await kit.clients.host.post(rounds, tooSlow)).json<unknown>()).toMatchObject({
      code: 'ROUND_RUNNING',
    });
    expect(
      (await kit.clients.host.post(`/api/v1/rounds/${id}/abort`, { reason: 'next' })).statusCode,
    ).toBe(200);
    const refused: [unknown, string][] = [
      [tooSlow, 'ROUND_SETTINGS_INVALID'],
      [{ settings: { 'round.halving': true }, season: 'spring' }, 'NOT_A_HALVING_DAY'],
      [{}, 'IN_SEASON_UNAVAILABLE'],
    ];
    for (const [body, code409] of refused) {
      expect((await kit.clients.host.post(rounds, body)).json<unknown>()).toMatchObject({
        code: code409,
      });
    }
  }, 60_000);
});
