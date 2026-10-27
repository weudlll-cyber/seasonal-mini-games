/**
 * @file   apps/server/test/authzSetup.ts
 * @module server/test
 * @brief  The world of the authorization matrix: callers, matches, rounds, and calls as each caller.
 *
 * Responsibility: start the socket kit; make the staff accounts (another host, a moderator, a
 *                 game admin and a staff-only security admin); open the host's match with a
 *                 player and a spare match; run one round to its abort and start a second that
 *                 stays open; call a route of the tables as any kind of caller with a fresh
 *                 session and an address of its own; list the routes Fastify registered; abort
 *                 the matches and remove the accounts at the end. Adapted from Bingo's matrix.
 * Depends on:     fastify, socket.io-client (types), ../src/auth/*, ./authzRoles, ./authzTable, ./session,
 *                 ./socketKit
 * Used by:        ./authzMatrix.integration.test
 * Spec:           docs/spec/09-testing-strategy.md §6; Bingo 12 §7
 */
import type { FastifyInstance, InjectOptions } from 'fastify';
import type { Socket } from 'socket.io-client';

import { deleteAccount, registerAccount } from '../src/auth/accounts.js';
import { createSession } from '../src/auth/sessions.js';
import type { Role } from './authzRoles.js';
import { ACCOUNT_PARAM, PARAMS, PERIOD, SETTINGS_DOCUMENT, type RouteCase } from './authzTable.js';
import { signIn } from './session.js';
import { startSocketKit, type SocketKit } from './socketKit.js';

export interface World {
  readonly kit: SocketKit;
  readonly accounts: Readonly<Record<Role, string | null>>;
  readonly ids: { code: string; spare: string; round: string; live: string; period: string };
  // The host's socket watching the match: the host is on the running round's roster.
  readonly hostSocket: Socket;
}

const STAFF = {
  otherHost: 'organizer',
  moderator: 'moderator',
  gameAdmin: 'game_admin',
  securityAdmin: 'security_admin',
} as const;

async function staffAccounts(kit: SocketKit): Promise<Record<keyof typeof STAFF, string>> {
  const pool = kit.harness.pool;
  const made: Partial<Record<keyof typeof STAFF, string>> = {};
  for (const [who, role] of Object.entries(STAFF) as [keyof typeof STAFF, string][]) {
    const r = await registerAccount(pool, {
      email: `authz-${who}@example.com`,
      displayName: `authz-${who.toLowerCase()}`,
      password: 'correct horse battery staple',
      roles: [role],
    });
    if (!r.ok) throw new Error(`could not make ${who}`);
    made[who] = r.id;
  }
  // Staff only: without the player role every account gets, a role's own permissions show.
  await pool.query(
    "DELETE FROM smg.role_assignments WHERE account_id = $1 AND role_id = 'player'",
    [made.securityAdmin],
  );
  return made as Record<keyof typeof STAFF, string>;
}

// A round of the match, started with the host and the player watching.
async function startedRound(kit: SocketKit, code: string): Promise<string> {
  const r = await kit.clients.host.post(`/api/v1/matches/${code}/rounds`, {
    settings: { 'round.cooldownS': 3, 'round.countdownS': 3, 'round.specialOn': false },
    season: 'spring',
    startNow: true,
  });
  if (r.statusCode !== 201) throw new Error(`round not created: ${r.body}`);
  return r.json<{ id: string }>().id;
}

async function rounds(kit: SocketKit, code: string): Promise<{ round: string; live: string }> {
  const round = await startedRound(kit, code);
  await kit.clients.host.post(`/api/v1/rounds/${round}/abort`, { reason: 'authz: ended round' });
  const live = await startedRound(kit, code);
  const state = await kit.clients.host.get(`/api/v1/rounds/${live}/state`);
  const opensAt = state.json<{ opensAt: number }>().opensAt;
  await new Promise((r) => setTimeout(r, Math.max(0, opensAt - Date.now()) + 50));
  return { round, live };
}

async function watching(kit: SocketKit, cookie: string, code: string): Promise<Socket> {
  const s = kit.open(cookie);
  if ((await kit.connected(s)) !== 'ok') throw new Error('socket refused');
  if (!(await kit.send(s, 'match.watch', { code })).ok) throw new Error('watch refused');
  return s;
}

export async function prepare(): Promise<World> {
  const kit = await startSocketKit();
  const admin = await adminId(kit);
  const staff = await staffAccounts(kit);
  const accounts: Record<Role, string | null> = {
    anonymous: null,
    guest: null,
    player: await kit.accountId('player-1'),
    matchPlayer: await kit.accountId('player-2'),
    host: await kit.accountId('host'),
    admin,
    ...staff,
  };
  const code = await kit.openMatch(['player-2']);
  const spare = await kit.openMatch(['player-2']);
  const hostSocket = await watching(kit, kit.clients.host.cookie, code);
  await watching(kit, kit.clients['player-2'].cookie, code);
  const periods = await kit.clients.host.get('/api/v1/leaderboards');
  const period = periods.json<{ periods: { id: string }[] }>().periods[0]?.id ?? '';
  const ids = { code, spare, ...(await rounds(kit, code)), period };
  return { kit, accounts, ids, hostSocket };
}

async function adminId(kit: SocketKit): Promise<string> {
  const admin = await signIn(kit.harness.built.fastify, 'admin');
  return (await admin.get('/api/v1/session')).json<{ account: { id: string } }>().account.id;
}

export async function tearDown(w: World): Promise<void> {
  for (const code of [w.ids.code, w.ids.spare])
    await w.kit.clients.host.post(`/api/v1/matches/${code}/abort`, { reason: 'test done' });
  const made = await w.kit.harness.pool.query<{ id: string }>(
    "SELECT id FROM smg.accounts WHERE email LIKE 'authz-%@example.com'",
  );
  for (const row of made.rows) await deleteAccount(w.kit.harness.pool, row.id);
  await w.kit.close();
}

// A fresh session per call, so logout, sign-in or deletion cannot spoil the next one.
export async function sessionOf(
  w: World,
  role: Role,
  cookieName = w.kit.harness.built.cookieName,
): Promise<{ cookie: string; csrf: string } | null> {
  if (role === 'anonymous') return null;
  const s = await createSession(w.kit.harness.pool, w.accounts[role], null);
  return { cookie: `${cookieName}=${s.token}`, csrf: s.csrfToken };
}

function urlOf(w: World, route: RouteCase): string {
  const p = route.path;
  const round = route.on === 'live' ? w.ids.live : w.ids.round;
  const id = p.startsWith('/api/v1/rounds/')
    ? round
    : p.startsWith('/api/v1/admin/settings/')
      ? SETTINGS_DOCUMENT
      : ACCOUNT_PARAM;
  let url = p
    .replace(':code', route.on === 'spare' ? w.ids.spare : w.ids.code)
    .replace(':id', id)
    .replace(PERIOD, w.ids.period);
  for (const [key, value] of Object.entries(PARAMS)) url = url.replace(key, value);
  return url;
}

let address = 0;

interface CallOptions {
  // Another app, which may name its session cookie differently (production: `__Host-`).
  readonly app?: { readonly fastify: FastifyInstance; readonly cookieName: string };
  // Replaces the session's CSRF token (undefined: none is sent).
  readonly csrf?: string | undefined;
}

// One call of a route as a kind of caller.
export async function callAs(
  w: World,
  role: Role,
  route: RouteCase,
  how: CallOptions = {},
): Promise<{ status: number; code: string | undefined; body: unknown }> {
  const app = how.app ?? w.kit.harness.built;
  const s = await sessionOf(w, role, app.cookieName);
  address += 1;
  const headers: Record<string, string> = {};
  if (s !== null) headers['cookie'] = s.cookie;
  const csrf = 'csrf' in how ? how.csrf : s?.csrf;
  if (csrf !== undefined) headers['x-csrf-token'] = csrf;
  const options: InjectOptions = {
    method: route.method,
    url: urlOf(w, route),
    // One address per call: the per-address limits stay out of the way.
    remoteAddress: `10.30.${String(Math.floor(address / 250))}.${String(address % 250)}`,
    headers,
    ...(route.body === undefined ? {} : { payload: route.body }),
  };
  const r = await app.fastify.inject(options);
  const body: unknown = r.body.startsWith('{') ? r.json<unknown>() : null;
  const code = (body as { code?: unknown } | null)?.code;
  return { status: r.statusCode, code: typeof code === 'string' ? code : undefined, body };
}

// "METHOD /path" for every route Fastify registered (HEAD is Fastify's own copy of GET).
export function registeredRoutes(app: FastifyInstance): string[] {
  const out: string[] = [];
  const stack: { depth: number; path: string }[] = [];
  for (const line of app.printRoutes({ commonPrefix: false }).split('\n')) {
    const node = treeNode(line);
    if (node === null) continue;
    while ((stack.at(-1)?.depth ?? -1) >= node.depth) stack.pop();
    const full = joinPath(stack.at(-1)?.path ?? '', node.segment);
    stack.push({ depth: node.depth, path: full });
    for (const method of node.methods) out.push(`${method} ${full}`);
  }
  return out.sort();
}

// One line of the tree: its indent, its path segment and its methods.
function treeNode(line: string): { depth: number; segment: string; methods: string[] } | null {
  const m = /^([\s│├└─]*)(\S+?)(?: \(([A-Z, ]+)\))?$/u.exec(line);
  if (m === null) return null;
  const methods = (m[3] ?? '').split(', ').filter((x) => x !== '' && x !== 'HEAD');
  return { depth: (m[1] ?? '').length, segment: m[2] ?? '', methods };
}

// Children of the root carry no leading slash; deeper ones do.
function joinPath(parent: string, segment: string): string {
  if (parent === '') return segment;
  return parent === '/' ? `/${segment}` : `${parent}${segment}`;
}
