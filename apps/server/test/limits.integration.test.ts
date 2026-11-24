/**
 * @file   apps/server/test/limits.integration.test.ts
 * @module server/test
 * @brief  The play limits of 05 §5 and the round limit of 08 §4 on a real server, real clock.
 *
 * Responsibility: a host's second round command inside 2 s is RATE_LIMITED, over HTTP and on
 *                 the socket alike, and passes after; a second team change inside 5 s is
 *                 refused and passes after; `DELETE /me` is refused once the password change's
 *                 limit is used up (O130); a round beyond `match.maxConcurrentRounds` is
 *                 SERVER_BUSY and is created once a running round ended (O131); a guest is never
 *                 the host of a match whose host account is gone; sign-ins are braked by their
 *                 failures only (T427). Matches are aborted at the
 *                 end; the settings changed are restored.
 * Depends on:     vitest, ../src/auth/accounts, ./socketKit, ./chatKit, ./session
 * Spec:           docs/spec/05-security-threat-model.md §5; docs/spec/08-admin-settings.md §4, §6
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { deleteAccount, registerAccount } from '../src/auth/accounts.js';
import { guestCookie, setSettings } from './chatKit.js';
import { SUITE_TIMEOUT_MS } from './harness.js';
import { signIn } from './session.js';
import { startSocketKit, type SocketKit } from './socketKit.js';

let kit: SocketKit;
const opened: string[] = [];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  kit = await startSocketKit({}, undefined, Date.now);
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  for (const code of opened) {
    await wait(2_100);
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  }
  await kit.close();
});

async function match(players: Parameters<SocketKit['openMatch']>[0] = []): Promise<string> {
  const code = await kit.openMatch(players);
  opened.push(code);
  return code;
}

const create = (code: string) =>
  kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
    settings: { 'round.countdownS': 3 },
    season: 'spring',
  });

describe('the play limits (05 §5)', () => {
  it('takes one host round command per 2 s, over HTTP and the socket', async () => {
    const code = await match(['player-1']);
    // The host and the player watch the match, so a start finds them present.
    const socket = kit.open(kit.clients.host.cookie);
    expect(await kit.connected(socket)).toBe('ok');
    const player = kit.open(kit.clients['player-1'].cookie);
    expect(await kit.connected(player)).toBe('ok');
    for (const s of [socket, player])
      expect((await kit.send(s, 'match.watch', { code })).ok).toBe(true);
    const r = await create(code);
    expect(r.statusCode).toBe(201);
    const id = r.json<{ id: string }>().id;
    const start = await kit.clients.host.post(`/api/v1/rounds/${id}/start`, {});
    expect([start.statusCode, start.json<{ code: string }>().code]).toEqual([429, 'RATE_LIMITED']);
    expect(await kit.send(socket, 'round.start', { roundId: id })).toMatchObject({
      code: 'RATE_LIMITED',
    });
    await wait(2_100);
    expect(await kit.send(socket, 'round.start', { roundId: id })).toMatchObject({ ok: true });
    await wait(2_100);
    const end = await kit.clients.host.post(`/api/v1/rounds/${id}/end`, {});
    expect(end.statusCode).toBe(200);
  }, 30_000);

  it('takes one team change per 5 s', async () => {
    const code = await match([]);
    const p1 = kit.clients['player-1'];
    await p1.post(`/api/v1/matches/${code}/join`, {});
    const first = await p1.post(`/api/v1/matches/${code}/team`, { team: 'summer' });
    expect(first.statusCode).toBe(204);
    const second = await p1.post(`/api/v1/matches/${code}/team`, { team: 'autumn' });
    expect(second.statusCode).toBe(429);
    await wait(5_100);
    const third = await p1.post(`/api/v1/matches/${code}/team`, { team: 'autumn' });
    expect(third.statusCode).toBe(204);
  }, 30_000);

  it("refuses DELETE /me once the password change's limit is used up (O130)", async () => {
    const p3 = kit.clients['player-3'];
    const del = () =>
      kit.harness.built.fastify.inject({
        method: 'DELETE',
        url: '/api/v1/me',
        payload: { password: 'not the password', confirm: 'nobody' },
        headers: { cookie: p3.cookie, 'x-csrf-token': p3.csrf },
      });
    // Five tries per account and address in 15 minutes, as for the password change.
    for (let i = 0; i < 5; i += 1) expect((await del()).statusCode).toBe(403);
    expect((await del()).statusCode).toBe(429);
    const change = await p3.post('/api/v1/me/password', { current: 'x', next: 'y' });
    expect(change.statusCode).toBe(429);
  });
});

describe('the host of a match whose host account is gone', () => {
  it('never lets a guest run the rounds of a match whose host is gone', async () => {
    const code = await match([]);
    const r = await create(code);
    const id = r.json<{ id: string }>().id;
    await kit.harness.pool.query('UPDATE smg.matches SET created_by = NULL WHERE code = $1', [
      code,
    ]);
    const guest = kit.open(await guestCookie(kit));
    expect(await kit.connected(guest)).toBe('ok');
    expect(await kit.send(guest, 'round.abort', { roundId: id, reason: 'x' })).toMatchObject({
      code: 'NOT_THE_HOST',
    });
    // The test's own abort at the end needs the host back.
    const host = await kit.accountId('host');
    await kit.harness.pool.query('UPDATE smg.matches SET created_by = $2 WHERE code = $1', [
      code,
      host,
    ]);
  });
});

describe('the rounds running at once (08 §4)', () => {
  it('answers SERVER_BUSY beyond the limit and creates the round once one ended', async () => {
    await wait(2_100);
    const admin = await signIn(kit.harness.built.fastify, 'admin');
    // Room for one more round than the earlier tests left running (their matches end last).
    const running = kit.harness.built.runtime.rounds.running();
    const restore = await setSettings(admin, 'matchmaking', {
      'match.maxConcurrentRounds': { value: running + 1 },
    });
    try {
      const first = await match([]);
      const r = await create(first);
      expect(r.statusCode).toBe(201);
      await wait(2_100);
      const second = await match([]);
      const busy = await create(second);
      expect([busy.statusCode, busy.json<{ code: string }>().code]).toEqual([503, 'SERVER_BUSY']);
      await wait(2_100);
      const id = r.json<{ id: string }>().id;
      const abort = await kit.clients.host.post(`/api/v1/rounds/${id}/abort`, { reason: 'test' });
      expect(abort.statusCode).toBe(200);
      await wait(2_100);
      expect((await create(second)).statusCode).toBe(201);
    } finally {
      await restore();
    }
  }, 40_000);
});

describe('the sign-in brake (T427)', () => {
  it('counts only failed sign-ins: right ones never use up the five, five wrong ones brake a right one', async () => {
    const created = await registerAccount(kit.harness.pool, {
      email: 'brake@example.com',
      displayName: 'brake',
      password: 'correct horse battery staple',
    });
    if (!created.ok) throw new Error('the test account was not created');
    const from = (password: string) =>
      kit.harness.built.fastify.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'brake@example.com', password },
        remoteAddress: '10.0.0.91',
      });
    try {
      // Seven right sign-ins in a row: more than the five, and all are let through.
      for (let i = 0; i < 7; i += 1) {
        expect((await from('correct horse battery staple')).statusCode).toBe(200);
      }
      for (let i = 0; i < 5; i += 1) expect((await from('wrong')).statusCode).toBe(401);
      // Looked at before the password is checked: the right one is refused too, as before.
      const refused = await from('correct horse battery staple');
      expect([refused.statusCode, refused.json<{ code: string }>().code]).toEqual([
        429,
        'RATE_LIMITED',
      ]);
    } finally {
      await deleteAccount(kit.harness.pool, created.id);
    }
  });
});
