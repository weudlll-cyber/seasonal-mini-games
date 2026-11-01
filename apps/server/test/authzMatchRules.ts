/**
 * @file   apps/server/test/authzMatchRules.ts
 * @module server/test
 * @brief  Rows of the authorization matrix beyond permissions: who may join a match or a
 *         shared roster (KICKED, the anti-multi-account rules).
 *
 * Responsibility: a player staff removed from a match is refused with KICKED when joining
 *                 again, while another player joins; in an install without a handoff provider
 *                 (standalone) the security document names `antiMulti.requireLinkedChat` as
 *                 unavailable and refuses switching it on (SETTING_UNAVAILABLE); with
 *                 `antiMulti.minAccountAgeH` set, a shared round's roster leaves out an account
 *                 younger than that and keeps the older ones. Each row restores what it changed.
 * Depends on:     vitest, ./authzSetup (World), ./session
 * Used by:        ./authzMatrix.integration.test
 * Spec:           docs/spec/05-security-threat-model.md §6; docs/spec/09-testing-strategy.md §6;
 *                 docs/DECISIONS.md T103, T104
 */
import { expect } from 'vitest';

import type { World } from './authzSetup.js';
import { signIn, type Client } from './session.js';

async function admin(w: World): Promise<Client> {
  return signIn(w.kit.harness.built.fastify, 'admin');
}

async function matchId(w: World, code: string): Promise<string> {
  const r = await w.kit.harness.pool.query<{ id: string }>(
    'SELECT id::text FROM smg.matches WHERE code = $1',
    [code],
  );
  return r.rows[0]?.id ?? '';
}

// Staff remove player-3 from a match: joining again is KICKED, another player still joins.
export async function kickedRow(w: World): Promise<void> {
  const { kit } = w;
  const code = await kit.openMatch(['player-3']);
  const staff = await admin(w);
  const kicked = await staff.post(`/api/v1/admin/matches/${await matchId(w, code)}/kick`, {
    playerKey: await kit.accountId('player-3'),
    reason: 'matrix row',
  });
  expect(kicked.statusCode).toBe(200);
  const again = await kit.clients['player-3'].post(`/api/v1/matches/${code}/join`, {});
  expect({ status: again.statusCode, body: again.json<unknown>() }).toEqual({
    status: 409,
    body: { code: 'KICKED' },
  });
  expect((await kit.clients['player-1'].post(`/api/v1/matches/${code}/join`, {})).statusCode).toBe(
    204,
  );
  await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'matrix row done' });
}

// Without a handoff provider the linked-chat rule cannot be switched on (05 §6).
export async function linkedChatRow(w: World): Promise<void> {
  const staff = await admin(w);
  const doc = await staff.get('/api/v1/admin/settings/security');
  const view = doc.json<{ version: number; unavailable?: Record<string, string> }>();
  expect(view.unavailable?.['antiMulti.requireLinkedChat']).toMatch(/^Standalone install/);
  const put = await staff.put('/api/v1/admin/settings/security', {
    version: view.version,
    overrides: { 'antiMulti.requireLinkedChat': { value: true } },
  });
  expect({ status: put.statusCode, body: put.json<unknown>() }).toEqual({
    status: 422,
    body: { code: 'SETTING_UNAVAILABLE', detail: 'antiMulti.requireLinkedChat' },
  });
}

async function setMinAge(staff: Client, hours: number): Promise<void> {
  const doc = await staff.get('/api/v1/admin/settings/security');
  const r = await staff.put('/api/v1/admin/settings/security', {
    version: doc.json<{ version: number }>().version,
    overrides: hours === 0 ? {} : { 'antiMulti.minAccountAgeH': { value: hours } },
  });
  expect(r.statusCode).toBe(200);
}

// With a minimum account age, a shared roster leaves out the younger account (05 §6).
export async function accountAgeRow(w: World): Promise<void> {
  const { kit } = w;
  const pool = kit.harness.pool;
  const staff = await admin(w);
  const [host, older] = [await kit.accountId('host'), await kit.accountId('player-1')];
  const before = await pool.query<{ id: string; created_at: Date }>(
    'SELECT id::text, created_at FROM smg.accounts WHERE id::text = ANY($1)',
    [[host, older]],
  );
  await pool.query(
    "UPDATE smg.accounts SET created_at = created_at - interval '3 hours' WHERE id::text = ANY($1)",
    [[host, older]],
  );
  await setMinAge(staff, 2);
  const code = await kit.openMatch(['player-1', 'player-3']);
  try {
    for (const who of ['host', 'player-1', 'player-3'] as const) {
      const s = kit.open(kit.clients[who].cookie);
      expect(await kit.connected(s)).toBe('ok');
      expect((await kit.send(s, 'match.watch', { code })).ok).toBe(true);
    }
    const round = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
      settings: { 'round.secretMode': 'shared', 'round.countdownS': 3 },
      season: 'spring',
      startNow: true,
    });
    const id = round.json<{ id: string }>().id;
    const state = await kit.clients.host.get(`/api/v1/rounds/${id}/state`);
    // The roster names players by their number in the match (T104).
    const roster = state.json<{ roster: { playerKey: string }[] }>().roster.map((r) => r.playerKey);
    expect(roster).toContain(await kit.numberOf(code, 'host'));
    expect(roster).toContain(await kit.numberOf(code, 'player-1'));
    expect(roster).not.toContain(await kit.numberOf(code, 'player-3'));
  } finally {
    await setMinAge(staff, 0);
    for (const row of before.rows) {
      await pool.query('UPDATE smg.accounts SET created_at = $2 WHERE id::text = $1', [
        row.id,
        row.created_at,
      ]);
    }
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'matrix row done' });
  }
}
