/**
 * @file   e2e/websiteStub.ts
 * @module e2e
 * @brief  Journey 36: the stand-in Seasonal Entertainment website, its account feed and its
 *         proxy's route.
 *
 * Responsibility: the website itself — the authorize route with its identity headers, the login
 *                 and the chat's frame, as its contract says — is the kit's stand-in
 *                 (`startWebsiteStandIn`, K74, T440). Here what the kit leaves to the game:
 *                 `startStubSite` adds the account-changes feed on a server of its own
 *                 (GET /api/games/mini-games/account-changes: the changes the test queued with
 *                 `remove` and `rights`, with the sync token, else 401; its cursors carry the
 *                 run's id, so a cursor an earlier run left in the database starts this run from
 *                 its beginning); `nginxConf` is the website's server block with the game's route
 *                 as the installer writes it (the kit's ops/lib/website-route.sh), every other
 *                 path to the stand-in, the website's session cookie removed from what the app
 *                 gets (DECISIONS T281). Test only: never part of an install.
 * Depends on:     node:crypto, node:http, node:net (types), @seasonal/kit/testing
 * Used by:        ./websiteStack, ./website.spec
 * Spec:           docs/spec/07-integration.md §2, §7; docs/spec/09-testing-strategy.md §4 (journey 36)
 */
import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { startWebsiteStandIn, type StandInGame, type StandInMember } from '@seasonal/kit/testing';

export interface StubSite {
  // The stand-in website's port, and the account feed's.
  readonly port: number;
  readonly feedPort: number;
  readonly token: string;
  // The members the website knows: a test adds its own.
  readonly members: StandInMember[];
  // Who the next visit of /login signs in.
  readonly signInAs: (memberId: number) => void;
  // Queues a `deleted` change for that member on the account feed.
  readonly remove: (id: number) => void;
  // Queues a `rights` change (the member's game sessions end; the website still knows them).
  readonly rights: (id: number) => void;
  readonly close: () => Promise<void>;
}

// The feed's cursor is "<run>-<count>": the changes after `count`, or all of them when the
// cursor is an earlier run's.
interface Feed {
  readonly token: string;
  readonly run: string;
  readonly changes: { id: number; kind: string }[];
}

function feed(f: Feed, req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://stub.invalid');
  if (url.pathname !== '/api/games/mini-games/account-changes') {
    res.writeHead(404).end();
    return;
  }
  if (req.headers['x-games-sync-token'] !== f.token) {
    res.writeHead(401).end();
    return;
  }
  const since = url.searchParams.get('since') ?? '';
  const seen = since.startsWith(`${f.run}-`) ? Number(since.slice(f.run.length + 1)) : 0;
  const page = { changes: f.changes.slice(seen), next: `${f.run}-${String(f.changes.length)}` };
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(page));
}

export async function startStubSite(game: StandInGame): Promise<StubSite> {
  const log: Feed = {
    token: randomBytes(24).toString('hex'),
    run: randomBytes(4).toString('hex'),
    changes: [],
  };
  const members: StandInMember[] = [];
  const website = await startWebsiteStandIn({ games: { 'mini-games': game }, members });
  const server = createServer((req, res) => {
    feed(log, req, res);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return {
    port: Number(new URL(website.origin).port),
    feedPort: (server.address() as AddressInfo).port,
    token: log.token,
    members,
    signInAs: website.signInAs,
    remove: (id) => {
      log.changes.push({ id, kind: 'deleted' });
    },
    rights: (id) => {
      log.changes.push({ id, kind: 'rights' });
    },
    close: async () => {
      await website.close();
      await new Promise((done) => server.close(done));
    },
  };
}

// The identity headers the proxy passes on (GAME-INTEGRATION.md §2).
const IDENTITY = [
  'X-Acting-User-Id',
  'X-Acting-User',
  'X-Acting-User-Roles',
  'X-Acting-User-Email-Verified',
  'X-Acting-User-Can-Host',
  'X-Acting-User-Steps',
  'X-Acting-Guest',
];

const nginxVar = (h: string): string => h.toLowerCase().replaceAll('-', '_');

// The app's Cookie without the website's session cookie, as the route file's cookie lines
// write it.
const STRIP = String.raw`"^(.*?)\s*(?:^|;)\s*(?:__Host-)?se\.sid=[^;]*(.*)$"`;
const COOKIE = [
  '    set $smg_mini_games_cookie $http_cookie;',
  ...Array.from(
    { length: 4 },
    () => `    if ($smg_mini_games_cookie ~ ${STRIP}) { set $smg_mini_games_cookie $1$2; }`,
  ),
  String.raw`    if ($smg_mini_games_cookie ~ "^;\s*(.*)$") { set $smg_mini_games_cookie $1; }`,
  '    proxy_set_header Cookie $smg_mini_games_cookie;',
];

// The game's route as the installer writes it (the kit's ops/lib/website-route.sh,
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
    ...COOKIE,
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
    ...COOKIE,
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
