/**
 * @file   apps/server/tools/previewWebsite.ts
 * @module server/tools
 * @brief  Development only: the game in website mode on this computer, behind the kit's local
 *         preview of the website (`pnpm preview:website`, kit K124).
 *
 * Responsibility: recreate the preview's own database (smg_preview, never the dev database `smg`),
 *                 build the player client as production does, start a server in website mode on
 *                 127.0.0.1:3965 (refused where the port is taken) under /games/mini-games/ with a proxy secret made for this run
 *                 (never printed or written), and the kit's `sk-preview` before it on 4400, which
 *                 prints the one address to open and signs its test member in, who may host.
 *                 The stand-in serves no account-changes feed, so the server logs that it could
 *                 not read it. Ctrl+C, or either process ending, stops both and drops the
 *                 database; a run cut short leaves it, and the next run replaces it.
 * Depends on:     node:child_process, node:crypto, node:fs, node:net, node:os, node:path,
 *                 node:url, ./database, @seasonal/kit (sk-preview), apps/web (vite build), docker
 * Used by:        apps/server/package.json script "preview:website", the root script of the name
 * Spec:           docs/spec/09-testing-strategy.md §1.1; docs/spec/07-integration.md §7;
 *                 docs/spec/10-repository-structure.md §4
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  dropDatabase,
  localDatabase,
  migrateDatabase,
  recreateDatabase,
  startDevPostgres,
} from './database.js';

const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url));
const WEB_DIR = fileURLToPath(new URL('../../web', import.meta.url));
const SERVER_PORT = 3965;
const SITE = 'http://127.0.0.1:4400';
const SECRET_NAME = 'SMG_WEBSITE_PROXY_SECRET';

// The preview's database: the development PostgreSQL's, under a name of its own.
function previewDatabase() {
  if (process.env['NODE_ENV'] !== 'development' || process.env['SMG_DEV'] !== '1') {
    throw new Error('refused: run through `pnpm preview:website` (the development settings)');
  }
  const url = new URL(process.env['DATABASE_URL'] ?? '');
  url.pathname = '/smg_preview';
  return localDatabase(url.toString());
}

// Another program on the port would answer /readyz in the preview server's place.
async function portFree(port: number): Promise<void> {
  await new Promise<void>((free, taken) => {
    const probe = createServer().once('error', taken);
    probe.listen(port, '127.0.0.1', () => probe.close(() => free()));
  });
}

function buildClient(outDir: string): void {
  const vite = path.join(WEB_DIR, 'node_modules/vite/bin/vite.js');
  const args = [vite, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'];
  const env = { ...process.env, NODE_ENV: 'production' };
  const built = spawnSync(process.execPath, args, { cwd: WEB_DIR, env, stdio: 'inherit' });
  if (built.status !== 0) throw new Error('the player client did not build');
}

// The server's settings in website mode (the kit's ADOPTION "The local preview").
function websiteEnv(databaseUrl: string, dir: string, secret: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: databaseUrl,
    SMG_PORT: String(SERVER_PORT),
    SMG_LOG_LEVEL: 'warn',
    SMG_DATA_DIR: path.join(dir, 'data'),
    SMG_WEB_DIR: path.join(dir, 'web'),
    SMG_AUTH_MODE: 'website',
    SMG_BASE_PATH: '/games/mini-games/',
    SMG_PUBLIC_URL: `${SITE}/games/mini-games/`,
    SMG_TRUSTED_PROXIES: '127.0.0.1',
    // No feed answers there: the stand-in has none.
    SMG_WEBSITE_LOCAL_URL: SITE,
    SMG_WEBSITE_SYNC_TOKEN: randomBytes(32).toString('hex'),
    [SECRET_NAME]: secret,
  };
}

async function ready(server: ChildProcess): Promise<void> {
  const end = Date.now() + 90_000;
  while (Date.now() < end && server.exitCode === null) {
    const ok = await fetch(`http://127.0.0.1:${String(SERVER_PORT)}/readyz`).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`the preview's server did not answer on ${String(SERVER_PORT)}`);
}

// The kit's `sk-preview`, beside its testing entry; the secret goes by the environment.
function startSite(secret: string): ChildProcess {
  const cli = new URL('./previewCli.js', import.meta.resolve('@seasonal/kit/testing'));
  const args = [
    fileURLToPath(cli),
    ...['--slug', 'mini-games', '--app', `http://127.0.0.1:${String(SERVER_PORT)}`],
    ...['--secret-header', 'X-Smg-Proxy-Secret', '--secret-env', SECRET_NAME],
    ...['--port', new URL(SITE).port, '--can-host'],
  ];
  const env = { ...process.env, [SECRET_NAME]: secret };
  return spawn(process.execPath, args, { env, stdio: 'inherit' });
}

const ended = (child: ChildProcess): Promise<unknown> =>
  child.exitCode === null ? new Promise((done) => child.once('exit', done)) : Promise.resolve();

// Until Ctrl+C or a child's end; then every child stops.
async function untilStopped(children: readonly ChildProcess[]): Promise<void> {
  const signal = new Promise((done) => {
    for (const name of ['SIGINT', 'SIGTERM'] as const) process.once(name, done);
  });
  await Promise.race([signal, ...children.map(ended)]);
  for (const child of children) child.kill();
  await Promise.all(children.map(ended));
}

const db = previewDatabase();
await portFree(SERVER_PORT);
startDevPostgres();
await recreateDatabase(db);
await migrateDatabase(db);
const dir = mkdtempSync(path.join(tmpdir(), 'smg-preview-'));
const children: ChildProcess[] = [];
try {
  buildClient(path.join(dir, 'web'));
  const secret = randomBytes(32).toString('hex');
  const env = websiteEnv(db.url, dir, secret);
  const server = spawn(process.execPath, ['--import=tsx', 'src/main.ts'], {
    cwd: SERVER_DIR,
    env,
    stdio: 'inherit',
  });
  children.push(server);
  await ready(server);
  children.push(startSite(secret));
  await untilStopped(children);
} finally {
  for (const child of children) child.kill();
  await dropDatabase(db);
  rmSync(dir, { recursive: true, force: true });
}
