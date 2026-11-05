/**
 * @file   e2e/builtAdmin.ts
 * @module e2e
 * @brief  The built admin app served as production serves it, for the Trusted Types check.
 *
 * Responsibility: build the admin app (vite build, production mode) into a temporary folder
 *                 and serve it under /admin/ on a free local port with the security headers
 *                 the server sends for its admin paths, read from the running server on 3910
 *                 (so the check follows apps/server/src/http/plugins/securityHeaders.ts, not a
 *                 copy); /api goes on to that server, so the page is same-origin with its API
 *                 as behind Caddy. The development server on 5411 cannot carry the header: its
 *                 React refresh preamble is an inline script, and a header there would need a
 *                 restart of the shared dev server (DECISIONS T179). `viteBuild` builds any of
 *                 the apps that way (journey 36 builds the player client with it).
 * Depends on:     node:child_process, node:fs, node:http, node:os, node:path, ./devStack
 * Used by:        ./trustedTypes.spec, ./websiteStack
 * Spec:           Bingo 03 §7; docs/security-pass.md
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, request, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { REPO_ROOT, SERVER_URL } from './devStack.js';

const ADMIN_DIR = path.join(REPO_ROOT, 'apps/admin');
const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};
// The headers of the server's admin answers that decide what the page may do.
const COPIED = ['content-security-policy', 'x-frame-options', 'cross-origin-opener-policy'];

export interface BuiltAdmin {
  readonly url: string;
  // The Content-Security-Policy the page is served with.
  readonly csp: string;
  readonly close: () => Promise<void>;
}

// A production build of the app in `appDir` (apps/admin, apps/web) into `outDir`.
export function viteBuild(appDir: string, outDir: string): void {
  const vite = path.join(appDir, 'node_modules/vite/bin/vite.js');
  const args = [vite, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'];
  // Vite builds in development mode when NODE_ENV says test or development.
  const env = { ...process.env, NODE_ENV: 'production' };
  const result = spawnSync(process.execPath, args, { cwd: appDir, env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`build of ${appDir} failed: ${result.stderr}`);
}

// Helmet's `upgrade-insecure-requests` (a default directive) is left out of the copy: this
// page is plain http on 127.0.0.1, which Chromium and Firefox never upgrade but WebKit does,
// so its scripts would fail the TLS handshake (CI, PR #1). Production is always behind TLS.
const UPGRADE = /;?\s*upgrade-insecure-requests/;

async function serverHeaders(): Promise<Record<string, string>> {
  const answer = await fetch(`${SERVER_URL}/admin/`, { redirect: 'manual' });
  const pairs = COPIED.map((h) => [h, answer.headers.get(h)?.replace(UPGRADE, '')] as const);
  return Object.fromEntries(pairs.filter((p): p is [string, string] => p[1] !== undefined));
}

// Only the server on 3910 is reached: the path (an /api/ path, checked by the caller) is
// appended to its fixed origin; a base URL would yield to an absolute request URL.
function proxy(req: IncomingMessage, res: ServerResponse, apiPath: string): void {
  const out = request(
    `${SERVER_URL}${apiPath}`,
    { method: req.method, headers: req.headers },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    },
  );
  req.pipe(out);
}

function serveFile(
  dir: string,
  headers: Record<string, string>,
  res: ServerResponse,
  url: string,
): void {
  const name = url.replace(/^\/admin\//, '').split('?')[0] || 'index.html';
  const file = path.join(dir, path.normalize(name));
  if (!file.startsWith(dir)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const body = readFileSync(file);
    const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
    res.writeHead(200, { ...headers, 'content-type': type }).end(body);
  } catch {
    res.writeHead(404, headers).end();
  }
}

export async function serveBuiltAdmin(): Promise<BuiltAdmin> {
  const dir = mkdtempSync(path.join(tmpdir(), 'smg-admin-'));
  viteBuild(ADMIN_DIR, dir);
  const headers = await serverHeaders();
  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url.startsWith('/api/')) proxy(req, res, url);
    else if (url.startsWith('/admin/')) serveFile(dir, headers, res, url);
    else res.writeHead(302, { location: '/admin/' }).end();
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}/admin/`,
    csp: headers['content-security-policy'] ?? '',
    close: async () => {
      await new Promise((done) => server.close(done));
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
