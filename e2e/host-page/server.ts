/**
 * @file   e2e/host-page/server.ts
 * @module e2e
 * @brief  Development only: a test host site on 127.0.0.1:5420 that embeds the game and signs
 *         handoff tokens for its own users.
 *
 * Responsibility: a tiny node:http server (no framework) standing in for a host website (07 §1):
 *                 `/` embeds the game with embed.js for the user named in `?user=`, and lists the
 *                 events the loader passes on; `/handoff-token` signs a 60-second EdDSA handoff
 *                 token (fresh `jti`, `links: ["telegram"]`) with a key pair drawn at start, whose
 *                 public key `/public-key` gives to the test that registers it as an identity
 *                 provider. Never part of the image: it lives in e2e/ and only Playwright starts it.
 * Depends on:     node:http, node:crypto (run with Node's type stripping)
 * Used by:        ../playwright.config (webServer), ../embed.spec
 * Spec:           docs/spec/07-integration.md §1, §4; docs/spec/09-testing-strategy.md §4 (journey 8)
 */
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createServer, type ServerResponse } from 'node:http';

const PORT = 5420;
const GAME = process.env['SMG_TEST_HOST_GAME'] ?? 'http://127.0.0.1:5410';
const HOST_ISSUER = `http://127.0.0.1:${String(PORT)}/test-host`;

// A new key pair at every start: nothing secret is ever written down.
const { publicKey, privateKey } = generateKeyPairSync('ed25519');

const part = (v: unknown): string => Buffer.from(JSON.stringify(v)).toString('base64url');

function handoffToken(user: string): string {
  const now = Math.floor(Date.now() / 1000);
  const head = part({ alg: 'EdDSA', typ: 'JWT' });
  const body = part({
    iss: HOST_ISSUER,
    aud: 'seasonal-mini-games',
    sub: `test-host:${user}`,
    name: user,
    links: ['telegram'],
    iat: now,
    exp: now + 60,
    jti: randomUUID(),
  });
  const signature = sign(null, Buffer.from(`${head}.${body}`), privateKey).toString('base64url');
  return `${head}.${body}.${signature}`;
}

const escape = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);

function page(user: string, view: string): string {
  const auth = `/handoff-token?user=${encodeURIComponent(user)}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Test host site</title></head>
<body>
<h1>Test host site</h1>
<p>Signed in on the host as <b>${escape(user)}</b>.</p>
<div id="game" data-smg-embed data-view="${escape(view)}" data-auth-url="${escape(auth)}"></div>
<ol id="events" data-testid="host-events"></ol>
<script>
  const list = document.getElementById('events');
  for (const type of ['smg:ready', 'smg:event', 'smg:navigate', 'smg:auth:logout']) {
    document.getElementById('game').addEventListener(type, () => {
      const item = document.createElement('li');
      item.textContent = type;
      list.append(item);
    });
  }
</script>
<script src="${escape(GAME)}/embed.js" async></script>
</body></html>`;
}

function send(res: ServerResponse, status: number, type: string, body: string): void {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${String(PORT)}`);
  const user = url.searchParams.get('user') ?? 'host-user';
  switch (url.pathname) {
    case '/':
      send(
        res,
        200,
        'text/html; charset=utf-8',
        page(user, url.searchParams.get('view') ?? 'lobby'),
      );
      return;
    case '/handoff-token':
      send(res, 200, 'application/json', JSON.stringify({ token: handoffToken(user) }));
      return;
    case '/public-key':
      send(
        res,
        200,
        'application/json',
        JSON.stringify({
          issuer: HOST_ISSUER,
          publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        }),
      );
      return;
    case '/healthz':
      send(res, 200, 'text/plain', 'ok');
      return;
    default:
      send(res, 404, 'text/plain', 'not found');
  }
});

// Both loopback names reach it: 127.0.0.1 is on the allowlist in the journey, localhost is not.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[test-host] http://127.0.0.1:${String(PORT)} embeds ${GAME}`);
});
