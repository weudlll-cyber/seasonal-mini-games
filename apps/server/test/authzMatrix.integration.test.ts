/**
 * @file   apps/server/test/authzMatrix.integration.test.ts
 * @module server/test
 * @brief  Who may call what: every HTTP route and WS intent × ten kinds of caller.
 *
 * Responsibility: for each route the server registers and each intent of the gateway (the
 *                 tables of ./authzTable), the callers that get through and the ones refused
 *                 (SIGN_IN_REQUIRED, FORBIDDEN, NOT_THE_HOST, CSRF_INVALID, NOT_IN_ROUND; a
 *                 refused socket handshake), each call with a fresh session. A route or intent
 *                 missing from the tables fails the test, so a new one cannot go in unreviewed;
 *                 the routes of a server with the built client and of a build without SMG_DEV
 *                 are listed too. The host plays their round with a player view while an admin
 *                 who is not on the roster watches and may not guess (S10). One write per route
 *                 group is refused without the CSRF token or with another session's. Matches
 *                 are aborted and the accounts made here removed at the end.
 *                 Adapted from Bingo's authzMatrix.integration.test.ts.
 * Depends on:     vitest, fastify (inject), ../src/auth/*, ../src/realtime/intents, ./authzTable,
 *                 ./authzSetup, ./harness, ./socketKit
 * Spec:           docs/spec/05-security-threat-model.md §1, M13; docs/spec/09-testing-strategy.md §6;
 *                 docs/DECISIONS.md O16, S10; Bingo 03 §3, §8
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { INTENT_TYPES } from '../src/realtime/intents.js';
import {
  INTENTS,
  REFUSALS,
  ROLES,
  ROUTES,
  CSRF_WRITES,
  SESSION,
  type RouteCase,
} from './authzTable.js';
import {
  callAs,
  prepare,
  registeredRoutes,
  sessionOf,
  tearDown,
  type World,
} from './authzSetup.js';
import { buildOn, SUITE_TIMEOUT_MS } from './harness.js';

let w: World;

beforeAll(async () => {
  w = await prepare();
}, SUITE_TIMEOUT_MS);

afterAll(async () => {
  await tearDown(w);
}, SUITE_TIMEOUT_MS);

const listed = (keep: (r: RouteCase) => boolean) =>
  ROUTES.filter(keep)
    .map((r) => `${r.method} ${r.path}`)
    .sort();

describe('the authorization matrix: HTTP routes', () => {
  it('lists every registered route, and only those', () => {
    expect(registeredRoutes(w.kit.harness.built.fastify)).toEqual(listed((r) => r.web !== true));
  });

  it('lists the routes of a server that serves the built client, and lets everyone read them', async () => {
    const web = mkdtempSync(path.join(tmpdir(), 'smg-authz-'));
    writeFileSync(path.join(web, 'index.html'), '<!doctype html>');
    const { harness } = w.kit;
    const app = await buildOn(harness.pool, harness.container.getConnectionUri(), {
      SMG_WEB_DIR: web,
    });
    try {
      expect(registeredRoutes(app.fastify)).toEqual(listed(() => true));
      for (const route of ROUTES.filter((r) => r.web === true)) {
        for (const role of ROLES) expect((await callAs(w, role, route, { app })).status).toBe(200);
      }
    } finally {
      await app.fastify.close();
      rmSync(web, { recursive: true, force: true });
    }
  });

  it('has no development route in a build without SMG_DEV', async () => {
    const { harness } = w.kit;
    const prod = await buildOn(harness.pool, harness.container.getConnectionUri(), {
      NODE_ENV: 'production',
      SMG_DEV: '0',
      SMG_ROUND_KEY: 'ab'.repeat(32),
    });
    try {
      expect(registeredRoutes(prod.fastify)).toEqual(
        listed((r) => r.web !== true && r.dev !== true),
      );
      for (const route of ROUTES.filter((r) => r.dev === true)) {
        expect((await callAs(w, 'host', route, { app: prod })).status).toBe(404);
      }
    } finally {
      await prod.fastify.close();
    }
  });

  it('lets through exactly the callers each route allows', async () => {
    const wrong: string[] = [];
    for (const route of ROUTES.filter((r) => r.web !== true)) {
      for (const role of ROLES) {
        const r = await callAs(w, role, route);
        const refused = r.code !== undefined && REFUSALS[r.code] === r.status;
        if (refused === route.allow.includes(role)) {
          wrong.push(
            `${route.method} ${route.path} as ${role}: ${String(r.status)} ${String(r.code)}`,
          );
        }
      }
    }
    expect(wrong).toEqual([]);
  }, 150_000);
});

describe('the authorization matrix: WS intents', () => {
  it('lists every intent of the gateway', () => {
    expect(Object.keys(INTENTS).sort()).toEqual([...INTENT_TYPES].sort());
  });

  it('refuses a socket without a session and answers each intent as allowed', async () => {
    const { kit } = w;
    expect(await kit.connected(kit.open(null))).toBe('UNAUTHORIZED');
    const wrong: string[] = [];
    for (const [t, intent] of Object.entries(INTENTS)) {
      for (const role of SESSION) {
        const socket = kit.open((await sessionOf(w, role))?.cookie ?? null);
        expect(await kit.connected(socket)).toBe('ok');
        const answer = await kit.send(socket, t, intent.data(w.ids));
        socket.disconnect();
        const refused = !answer.ok && REFUSALS[answer.code ?? ''] !== undefined;
        if (refused === intent.allow.includes(role)) {
          wrong.push(`${t} as ${role}: ${answer.ok ? 'ok' : (answer.code ?? '?')}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  }, 120_000);

  it('answers an intent nobody listed with UNKNOWN_INTENT', async () => {
    const socket = w.kit.open(w.kit.clients.host.cookie);
    expect(await w.kit.connected(socket)).toBe('ok');
    expect((await w.kit.send(socket, 'chat.send', {})).code).toBe('UNKNOWN_INTENT');
    socket.disconnect();
  });
});

describe('the host plays, an admin watches (S10, O16)', () => {
  const state: RouteCase = {
    method: 'GET',
    path: '/api/v1/rounds/:id/state',
    allow: [],
    on: 'live',
  };
  const guess = (value: number): RouteCase => ({
    method: 'POST',
    path: '/api/v1/rounds/:id/guesses',
    body: { value },
    allow: [],
    on: 'live',
  });

  it('gives the host a player view and a guess; an admin off the roster only the spectator view', async () => {
    const roleOf = async (who: 'host' | 'matchPlayer' | 'admin' | 'guest') =>
      ((await callAs(w, who, state)).body as { role?: string }).role;
    expect(await roleOf('host')).toBe('player');
    expect(await roleOf('matchPlayer')).toBe('player');
    expect(await roleOf('admin')).toBe('spectator');
    expect(await roleOf('guest')).toBe('spectator');
    const secrets = await w.kit.secretsOf(w.ids.live);
    const wrong = secrets.mode === 'shared' && secrets.value === 1 ? 2 : 1;
    expect(
      await w.kit.send(w.hostSocket, 'guess', { roundId: w.ids.live, value: wrong }),
    ).toMatchObject({
      ok: true,
    });
    const admin = w.kit.open((await sessionOf(w, 'admin'))?.cookie ?? null);
    expect(await w.kit.connected(admin)).toBe('ok');
    expect(await w.kit.send(admin, 'guess', { roundId: w.ids.live, value: wrong })).toMatchObject({
      code: 'NOT_IN_ROUND',
    });
    admin.disconnect();
    expect(await callAs(w, 'admin', guess(wrong))).toMatchObject({
      status: 409,
      code: 'NOT_IN_ROUND',
    });
  });
});

describe('CSRF on every route group', () => {
  it('refuses a write without the token and with a token of another session', async () => {
    const other = await sessionOf(w, 'player');
    const wrong: string[] = [];
    for (const route of CSRF_WRITES) {
      for (const token of [undefined, other?.csrf ?? 'x']) {
        const r = await callAs(w, 'admin', route, { csrf: token });
        if (r.status !== 403 || r.code !== 'CSRF_INVALID') {
          wrong.push(
            `${route.method} ${route.path} token=${String(token !== undefined)}: ${String(r.status)}`,
          );
        }
      }
    }
    expect(CSRF_WRITES.length).toBeGreaterThanOrEqual(13);
    expect(wrong).toEqual([]);
  });
});
