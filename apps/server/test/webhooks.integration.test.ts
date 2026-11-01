/**
 * @file   apps/server/test/webhooks.integration.test.ts
 * @module server/test
 * @brief  Webhooks end to end: admin CRUD with audit, events queued from the lifecycle, signed
 *         delivery to a local HTTPS receiver, a retry after a failure.
 *
 * Responsibility: with SMG_FEATURE_WEBHOOKS on, an admin creates an endpoint (its secret shown
 *                 once, never listed, sealed at rest) and the audit keeps it without the secret;
 *                 opening a match, a round's countdown and its end (winner and placings by
 *                 display name) and closing the match queue one delivery each; the deliverer
 *                 sends them through the safe client (test CA, loopback allowed) signed with
 *                 HMAC-SHA256, retries the one the receiver refused, and the admin sees them.
 * Depends on:     vitest, node:https, node:crypto, ../src/*, ./selfSignedCert, ./socketKit
 * Spec:           docs/spec/07-integration.md §1, §3.2; Bingo 07 §5; docs/spec/09-testing-strategy.md §2
 */
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:https';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadEnv } from '../src/config/env.js';
import { derivedKey, roundKeyFrom } from '../src/config/roundKey.js';
import { safePost } from '../src/integration/safePost.js';
import { WebhookDelivery } from '../src/integration/webhookDelivery.js';
import { WebhookStore } from '../src/integration/webhooks.js';
import { SUITE_TIMEOUT_MS } from './harness.js';
import { selfSignedCert } from './selfSignedCert.js';
import { signIn, type Client } from './session.js';
import { startSocketKit, type SocketKit } from './socketKit.js';

interface Received {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: string;
}

let kit: SocketKit;
let admin: Client;
let receiver: Server;
let url = '';
const received: Received[] = [];
// The receiver's answers, one per request; 200 once they run out.
const answers: number[] = [];
const tls = selfSignedCert();
let delivery: WebhookDelivery;

beforeAll(async () => {
  kit = await startSocketKit({ SMG_FEATURE_WEBHOOKS: '1' });
  admin = await signIn(kit.harness.built.fastify, 'admin');
  receiver = createServer({ cert: tls.cert, key: tls.key }, (req, res) => {
    let body = '';
    req.on('data', (c: Buffer) => (body += c.toString()));
    req.on('end', () => {
      received.push({ headers: req.headers, body });
      res.statusCode = answers.shift() ?? 200;
      res.end();
    });
  });
  await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve));
  const address = receiver.address();
  url = `https://127.0.0.1:${String(typeof address === 'object' && address ? address.port : 0)}/hook`;
  // A deliverer as the server's own, with the test receiver's certificate trusted.
  const env = loadEnv({ NODE_ENV: 'test', DATABASE_URL: kit.harness.container.getConnectionUri() });
  const store = new WebhookStore(
    kit.harness.pool,
    derivedKey(roundKeyFrom(env), 'smg webhook secrets'),
  );
  delivery = new WebhookDelivery(store, (to, body, headers) =>
    safePost(to, body, headers, { allowLocal: true, ca: tls.cert }),
  );
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  await new Promise((resolve) => receiver.close(resolve));
  await kit.close();
}, SUITE_TIMEOUT_MS);

async function until<T>(probe: () => Promise<T | null>): Promise<T> {
  for (const end = Date.now() + 10_000; Date.now() < end;) {
    const v = await probe();
    if (v !== null) return v;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('timed out');
}

const pending = async (event: string) =>
  (
    await kit.harness.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM smg.webhook_deliveries WHERE event = $1`,
      [event],
    )
  ).rows[0]?.n ?? 0;

function checkSignature(r: Received, secret: string): void {
  const header = String(r.headers['x-smg-signature']);
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header);
  expect(m).not.toBeNull();
  const mac = createHmac('sha256', secret)
    .update(`${m?.[1] ?? ''}.${r.body}`)
    .digest('hex');
  expect(m?.[2]).toBe(mac);
}

async function createEndpoint(): Promise<{ id: string; secret: string }> {
  const events = ['match.opened', 'round.countdown', 'round.ended', 'match.closed'];
  const r = await admin.post('/api/v1/admin/webhooks', { url, events, enabled: true });
  expect(r.statusCode).toBe(201);
  const made = r.json<{ id: string; secret: string; url: string }>();
  expect(made.secret).toMatch(/^[\w-]{43}$/);
  const list = await admin.get('/api/v1/admin/webhooks');
  expect(list.body).not.toContain(made.secret);
  const listed = list.json<{ feature: boolean; endpoints: { id: string; url: string }[] }>();
  expect(listed.feature).toBe(true);
  expect(listed.endpoints.find((e) => e.id === made.id)?.url).toBe(url);
  const stored = await kit.harness.pool.query<{ secret_enc: Buffer }>(
    'SELECT secret_enc FROM smg.webhook_endpoints WHERE id = $1',
    [made.id],
  );
  expect(stored.rows[0]?.secret_enc.toString('latin1')).not.toContain(made.secret);
  const audit = await kit.harness.pool.query<{ diff: unknown }>(
    "SELECT diff FROM smg.audit_log WHERE action = 'webhook.create' AND target_id = $1",
    [made.id],
  );
  expect(audit.rows).toHaveLength(1);
  expect(JSON.stringify(audit.rows[0]?.diff)).not.toContain(made.secret);
  return made;
}

// A round of the match (the host and player 1 present) won by the host.
async function wonRound(code: string): Promise<string> {
  const [s, p1] = [kit.open(kit.clients.host.cookie), kit.open(kit.clients['player-1'].cookie)];
  for (const socket of [s, p1]) {
    expect(await kit.connected(socket)).toBe('ok');
    expect((await kit.send(socket, 'match.watch', { code })).ok).toBe(true);
  }
  const r = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
    settings: { 'round.cooldownS': 3, 'round.countdownS': 3, 'round.specialOn': false },
    season: 'spring',
    startNow: true,
  });
  const id = r.json<{ id: string }>().id;
  const state = await kit.clients.host.get(`/api/v1/rounds/${id}/state`);
  const opensAt = state.json<{ opensAt: number }>().opensAt;
  await new Promise((done) => setTimeout(done, Math.max(0, opensAt - Date.now()) + 50));
  const secrets = await kit.secretsOf(id);
  const value = secrets.mode === 'shared' ? secrets.value : 0;
  expect(await kit.send(s, 'guess', { roundId: id, value })).toMatchObject({ ok: true });
  s.disconnect();
  p1.disconnect();
  return id;
}

// The round's countdown and end and the match's close, as the receiver got them.
async function checkRoundEvents(code: string, roundId: string): Promise<void> {
  const bodies = received
    .slice(2)
    .map((r) => JSON.parse(r.body) as { event: string; data: Record<string, unknown> });
  expect(bodies.map((b) => b.event)).toEqual(['round.countdown', 'round.ended', 'match.closed']);
  expect(bodies[0]?.data).toMatchObject({
    match: code,
    roundId,
    season: 'spring',
    halving: false,
  });
  expect(typeof bodies[0]?.data['opensAt']).toBe('number');
  expect(bodies[1]?.data).toMatchObject({
    match: code,
    roundId,
    reason: 'solved',
    winner: 'dev-host',
    placings: [{ place: 1, name: 'dev-host' }],
  });
  // Names only: no account id in any payload.
  const hostId = await kit.accountId('host');
  for (const r of received) expect(r.body).not.toContain(hostId);
}

// The admin's view of the endpoint's deliveries; then the endpoint is removed.
async function checkDeliveriesThenRemove(endpointId: string): Promise<void> {
  const deliveries = await admin.get(`/api/v1/admin/webhooks/${endpointId}/deliveries`);
  const views = deliveries.json<{
    deliveries: { status: string; attempts: number; event: string }[];
  }>();
  expect(views.deliveries).toHaveLength(4);
  expect(views.deliveries.every((d) => d.status === 'delivered')).toBe(true);
  expect(views.deliveries.find((d) => d.event === 'match.opened')?.attempts).toBe(2);
  expect((await admin.get('/api/v1/admin/webhooks')).json<unknown>()).toMatchObject({
    endpoints: [{ lastDelivery: { status: 'delivered' } }],
  });
  const removed = await kit.harness.built.fastify.inject({
    method: 'DELETE',
    url: `/api/v1/admin/webhooks/${endpointId}`,
    headers: { cookie: admin.cookie, 'x-csrf-token': admin.csrf },
  });
  expect(removed.statusCode).toBe(204);
}

describe('webhooks', () => {
  it('queue the lifecycle, deliver it signed, retry a refused one and show the deliveries', async () => {
    const endpoint = await createEndpoint();
    const code = await kit.openMatch(['player-1']);
    await until(async () => ((await pending('match.opened')) > 0 ? true : null));
    // The receiver refuses the first attempt: kept pending with its error, retried after 30 s.
    answers.push(500);
    expect(await delivery.deliverDue()).toBe(1);
    expect(await delivery.deliverDue()).toBe(0);
    expect(await delivery.deliverDue(Date.now() + 31_000)).toBe(1);
    expect(received).toHaveLength(2);
    const opened = JSON.parse(received[1]?.body ?? '{}') as { event: string; data: unknown };
    expect(opened).toMatchObject({ event: 'match.opened', data: { match: code } });
    for (const r of received) checkSignature(r, endpoint.secret);
    expect(received[1]?.headers['x-smg-event']).toBe('match.opened');

    const roundId = await wonRound(code);
    await until(async () => ((await pending('round.ended')) > 0 ? true : null));
    await kit.clients.host.post(`/api/v1/matches/${code}/close`, {});
    await until(async () => ((await pending('match.closed')) > 0 ? true : null));
    expect(await delivery.deliverDue()).toBe(3);
    await checkRoundEvents(code, roundId);
    await checkDeliveriesThenRemove(endpoint.id);
  }, 60_000);

  it('marks a delivery failed after the first attempt and three retries', async () => {
    const endpoint = await createEndpoint();
    answers.push(500, 502, 503, 504);
    const code = await kit.openMatch([]);
    // The first test's endpoint is gone, and its deliveries with it.
    await until(async () => ((await pending('match.opened')) > 0 ? true : null));
    let at = Date.now();
    for (let i = 0; i < 4; i += 1) {
      expect(await delivery.deliverDue(at)).toBe(1);
      at += 10 * 60_000;
    }
    expect(await delivery.deliverDue(at)).toBe(0);
    const views = (await admin.get(`/api/v1/admin/webhooks/${endpoint.id}/deliveries`)).json<{
      deliveries: { status: string; attempts: number; lastError: string }[];
    }>();
    expect(views.deliveries[0]).toMatchObject({
      status: 'failed',
      attempts: 4,
      lastError: 'answered 504',
    });
    await kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  }, 60_000);
});
