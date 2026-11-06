/**
 * @file   e2e/websiteStub.ts
 * @module e2e
 * @brief  Journey 36: a stand-in for the Seasonal Entertainment website and its proxy's route file.
 *
 * Responsibility: `startStubSite` runs a tiny node:http website on a free local port that answers
 *                 as the real one does for Mini Games (its docs/AUTH.md, docs/EMBED.md; the same
 *                 rules as ops/test/stub-website.py): GET /api/games/mini-games/authorize without
 *                 X-Original-Method 403, carrying X-Smg-Proxy-Secret 500 (the secret must never
 *                 reach the website), with the cookie `stub_user` of a known member 204 and the
 *                 identity headers, anyone else 204 with X-Acting-Guest alone (never 401);
 *                 GET /login?next= signs the member the test chose in (that cookie) and goes back
 *                 to `next`; GET /embed/chat the chat room's page with its room and theme, which
 *                 speaks the embed's postMessage protocol (docs/EMBED.md, `chatScript`);
 *                 GET /api/games/mini-games/account-changes the changes the test queued (`remove`)
 *                 with the sync token, else 401. Its cursors carry the run's id, so a cursor an
 *                 earlier run left in the database starts this run from its beginning.
 *                 `nginxConf` is the website's server block with the game's route as
 *                 ops/lib/website-route.sh (write_nginx_route) writes it, and every other path to
 *                 this stand-in. Test only: never part of an install.
 * Depends on:     node:crypto, node:http, node:net (types)
 * Used by:        ./websiteStack, ./website.spec
 * Spec:           docs/spec/07-integration.md §2, §7; docs/spec/09-testing-strategy.md §4 (journey 36)
 */
import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface StubMember {
  // The website's user id: a number, never reused.
  readonly id: number;
  readonly name: string;
  readonly canHost: boolean;
  readonly steps: readonly { ladder: string; name: string; icon: string | null }[];
}

export interface StubSite {
  readonly port: number;
  readonly token: string;
  // The members the website knows, by id.
  readonly members: Map<number, StubMember>;
  // Who the next visit of /login signs in.
  loginAs: number | null;
  // Queues a `deleted` change for that member on the account feed.
  readonly remove: (id: number) => void;
  readonly close: () => Promise<void>;
}

const IDENTITY = [
  'X-Acting-User-Id',
  'X-Acting-User',
  'X-Acting-User-Roles',
  'X-Acting-User-Email-Verified',
  'X-Acting-User-Can-Host',
  'X-Acting-User-Steps',
  'X-Acting-Guest',
];

function headersOf(m: StubMember): Record<string, string> {
  return {
    'X-Acting-User-Id': String(m.id),
    'X-Acting-User': m.name,
    'X-Acting-User-Roles': 'member',
    'X-Acting-User-Email-Verified': 'true',
    'X-Acting-User-Can-Host': String(m.canHost),
    'X-Acting-User-Steps': Buffer.from(JSON.stringify(m.steps)).toString('base64url'),
  };
}

function cookieUser(req: IncomingMessage): number | null {
  const match = /(?:^|;\s*)stub_user=(\d+)/.exec(req.headers.cookie ?? '');
  return match === null ? null : Number(match[1]);
}

function send(
  res: ServerResponse,
  status: number,
  headers: Record<string, string> = {},
  body = '',
) {
  res.writeHead(status, { 'cache-control': 'no-store', ...headers }).end(body);
}

function authorize(site: StubSite, req: IncomingMessage, res: ServerResponse): void {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(String(req.headers['x-original-method']))) {
    send(res, 403);
    return;
  }
  if (req.headers['x-smg-proxy-secret'] !== undefined) {
    send(res, 500, {}, 'the proxy secret reached the website');
    return;
  }
  const member = site.members.get(cookieUser(req) ?? -1);
  send(res, 204, member === undefined ? { 'X-Acting-Guest': 'true' } : headersOf(member));
}

function login(site: StubSite, url: URL, res: ServerResponse): void {
  const next = url.searchParams.get('next') ?? '/';
  // Only a path on this site, as the website's own login allows.
  const back = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const cookie =
    site.loginAs === null ? {} : { 'set-cookie': `stub_user=${String(site.loginAs)}; Path=/` };
  send(res, 302, { location: back, ...cookie });
}

// The embed's side of EMBED.md's postMessage API: it finds its parent (ancestorOrigins, else
// the referrer), talks only to this site (the website's check, simplified), posts `ready`, and
// on `visible` shows "hidden" or "visible"; `arrive()` (called by the journey) is a message
// from someone else, counted and posted as `unread` while it is out of sight, 0 again when
// shown.
function chatScript(room: string): string {
  return `const room = ${JSON.stringify(room)};
const parent = location.ancestorOrigins?.[0] ?? (document.referrer ? new URL(document.referrer).origin : '');
let hidden = false;
let count = 0;
const say = (m) => {
  if (parent === location.origin) window.parent.postMessage({ source: 'seasonal-chat', ...m }, parent);
};
const sight = document.querySelector('[data-testid="stub-chat-sight"]');
window.addEventListener('message', (e) => {
  if (e.origin !== parent || e.source !== window.parent) return;
  if (e.data?.source !== 'seasonal-chat-host' || e.data.type !== 'visible') return;
  hidden = e.data.visible === false;
  sight.textContent = hidden ? 'hidden' : 'visible';
  if (hidden || count === 0) return;
  count = 0;
  say({ type: 'unread', room, count });
});
window.arrive = () => {
  if (hidden) say({ type: 'unread', room, count: ++count });
};
say({ type: 'ready', room, signedIn: false });`;
}

function chatPage(url: URL, res: ServerResponse): void {
  const room = (url.searchParams.get('room') ?? '').replace(/[^\w-]/g, '');
  const theme = (url.searchParams.get('theme') ?? '').replace(/[^\w-]/g, '');
  const body = [
    '<!doctype html><title>Chat</title>',
    `<p data-testid="stub-chat">Stub chat: room ${room}, theme ${theme}</p>`,
    '<p data-testid="stub-chat-sight">visible</p>',
    `<script>${chatScript(room)}</script>`,
  ].join('');
  send(res, 200, { 'content-type': 'text/html; charset=utf-8' }, body);
}

// The feed's cursor is "<run>-<count>": the changes after `count`, or all of them when the
// cursor is an earlier run's.
interface Feed {
  readonly token: string;
  readonly run: string;
  readonly changes: { id: number; kind: string }[];
}

function feed(f: Feed, req: IncomingMessage, url: URL, res: ServerResponse): void {
  const { run, changes } = f;
  if (req.headers['x-games-sync-token'] !== f.token) {
    send(res, 401);
    return;
  }
  const since = url.searchParams.get('since') ?? '';
  const seen = since.startsWith(`${run}-`) ? Number(since.slice(run.length + 1)) : 0;
  const page = { changes: changes.slice(seen), next: `${run}-${String(changes.length)}` };
  send(res, 200, { 'content-type': 'application/json' }, JSON.stringify(page));
}

export async function startStubSite(): Promise<StubSite> {
  const log: Feed = {
    token: randomBytes(24).toString('hex'),
    run: randomBytes(4).toString('hex'),
    changes: [],
  };
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://stub.invalid');
    if (url.pathname === '/api/games/mini-games/authorize') authorize(site, req, res);
    else if (url.pathname === '/api/games/mini-games/account-changes') feed(log, req, url, res);
    else if (url.pathname === '/login') login(site, url, res);
    else if (url.pathname === '/embed/chat') chatPage(url, res);
    else send(res, 200, { 'content-type': 'text/plain' }, 'the website');
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const site: StubSite = {
    port: (server.address() as AddressInfo).port,
    token: log.token,
    members: new Map(),
    loginAs: null,
    remove: (id) => {
      log.changes.push({ id, kind: 'deleted' });
    },
    close: () =>
      new Promise((done) => {
        server.close(() => {
          done(undefined);
        });
      }),
  };
  return site;
}

const nginxVar = (h: string): string => h.toLowerCase().replaceAll('-', '_');

// The game's route as the installer writes it (ops/lib/website-route.sh, write_nginx_route,
// DECISIONS T231), inside the website's server block; `app` and `site` are host:port as the
// container reaches them. One difference: Host keeps the port ($http_host), as this site is
// not on port 443.
export function nginxConf(o: { listen: number; app: string; site: string; secret: string }) {
  const clear = ['X-Smg-Proxy-Secret', ...IDENTITY].map((h) => `    proxy_set_header ${h} "";`);
  const pass = IDENTITY.flatMap((h) => [
    `    auth_request_set $smg_${nginxVar(h)} $upstream_http_${nginxVar(h)};`,
    `    proxy_set_header ${h} $smg_${nginxVar(h)};`,
  ]);
  const forwarded = [
    '    proxy_set_header Host $http_host;',
    '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '    proxy_set_header X-Forwarded-Proto $scheme;',
  ];
  return [
    'server {',
    `  listen ${String(o.listen)};`,
    '  location = /games/mini-games { return 308 /games/mini-games/; }',
    '  location ^~ /games/mini-games/metrics { return 404; }',
    '  location ^~ /games/mini-games/ {',
    ...clear,
    ...forwarded,
    '    proxy_http_version 1.1;',
    '    proxy_set_header Upgrade $http_upgrade;',
    '    proxy_set_header Connection $http_connection;',
    `    proxy_pass http://${o.app};`,
    '  }',
    '  location = /games/mini-games/auth/website {',
    '    auth_request /_smg_mini_games_authorize;',
    ...pass,
    `    proxy_set_header X-Smg-Proxy-Secret "${o.secret}";`,
    '    error_page 401 403 = @smg_mini_games_login;',
    ...forwarded,
    `    proxy_pass http://${o.app};`,
    '  }',
    '  location = /_smg_mini_games_authorize {',
    '    internal;',
    `    proxy_pass http://${o.site}/api/games/mini-games/authorize;`,
    '    proxy_pass_request_body off;',
    '    proxy_set_header Content-Length "";',
    '    proxy_set_header X-Smg-Proxy-Secret "";',
    '    proxy_set_header Host $http_host;',
    '    proxy_set_header X-Original-Method $request_method;',
    '    proxy_set_header X-Original-URI $request_uri;',
    '  }',
    '  location @smg_mini_games_login { return 302 /games/mini-games/auth/website/login$is_args$args; }',
    // The website itself: its login, its chat and its Mini Games endpoints.
    '  location / {',
    ...clear,
    '    proxy_set_header Host $http_host;',
    `    proxy_pass http://${o.site};`,
    '  }',
    '}',
    '',
  ].join('\n');
}
