/**
 * @file   e2e/websiteStack.ts
 * @module e2e
 * @brief  Journey 36: the game in website mode behind a stand-in website's nginx, started and
 *         removed by the test.
 *
 * Responsibility: `startWebsiteStack` makes the journey's own database in the dev PostgreSQL
 *                 (smg_e2e_website, kept between runs, so the server migrates only what is new),
 *                 builds the player client as production does (./builtAdmin `viteBuild`), starts
 *                 the stand-in website (./websiteStub) and a server in website mode on 3930
 *                 (SMG_AUTH_MODE=website under /games/mini-games/, its feed at the stand-in,
 *                 the built client from SMG_WEB_DIR), then the nginx container smg-e2e-website on
 *                 5430 with the website's server block and the game's route (`nginxConf`). On
 *                 Linux the container shares the host's network; elsewhere (Docker Desktop) it
 *                 publishes 127.0.0.1:5430 and reaches the host as host.docker.internal. Either
 *                 way the server sees the proxy as 127.0.0.1, its only trusted proxy. `close`
 *                 stops the server, removes the container and the stand-in, and the build.
 *                 Its own database, not the dev database: two servers on one database would
 *                 both run the round scheduler and recovery, and a round runs on one instance
 *                 only (DECISIONS T4, T13, T241).
 * Depends on:     node:child_process, node:crypto, node:fs, node:os, node:path, ./builtAdmin,
 *                 ./devStack, ./websiteStub, docker
 * Used by:        ./website.spec
 * Spec:           docs/spec/09-testing-strategy.md §4 (journey 36); docs/spec/07-integration.md §7
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { viteBuild } from './builtAdmin.js';
import {
  COMPOSE_FILE,
  ENV_FILE,
  REPO_ROOT,
  WEBSITE_SERVER_PORT,
  WEBSITE_URL,
  databaseUrl,
} from './devStack.js';
import { nginxConf, startStubSite, type StubSite } from './websiteStub.js';

const DATABASE = 'smg_e2e_website';
const CONTAINER = 'smg-e2e-website';
// nginx 1.31.8 (alpine), pinned by digest as the CI images are.
const NGINX_IMAGE =
  'nginx:1.31.8-alpine@sha256:785835ea65db4bba6f021acc0f3be91b0fef76a53fe41f8588c6698d2aed0606';
const SITE_PORT = Number(new URL(WEBSITE_URL).port);

export interface WebsiteStack {
  readonly site: StubSite;
  readonly close: () => Promise<void>;
}

const docker = (args: readonly string[]): string =>
  execFileSync('docker', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' });

// The journey's database beside the dev database, made once.
function ensureDatabase(): void {
  const psql = 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"';
  const script = `${psql} -tAc "SELECT 1 FROM pg_database WHERE datname = '${DATABASE}'" | grep -q 1 || ${psql} -c "CREATE DATABASE ${DATABASE}"`;
  docker(
    ['compose', '--env-file', ENV_FILE, '-f', COMPOSE_FILE, 'exec', '-T', 'postgres'].concat([
      'sh',
      '-c',
      script,
    ]),
  );
}

async function waitFor(url: string, alive: () => boolean, what: string): Promise<void> {
  const end = Date.now() + 90_000;
  while (Date.now() < end && alive()) {
    const ok = await fetch(url)
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`${what} did not answer at ${url}`);
}

function startServer(site: StubSite, secret: string, dir: string): ChildProcess {
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl(DATABASE),
    SMG_PORT: String(WEBSITE_SERVER_PORT),
    SMG_LOG_LEVEL: 'warn',
    // Plain http on 127.0.0.1: the session cookie without Secure, as on the dev server.
    SMG_DEV: '1',
    SMG_DATA_DIR: path.join(dir, 'data'),
    SMG_WEB_DIR: path.join(dir, 'web'),
    SMG_AUTH_MODE: 'website',
    SMG_BASE_PATH: '/games/mini-games/',
    SMG_PUBLIC_URL: `${WEBSITE_URL}/games/mini-games/`,
    SMG_TRUSTED_PROXIES: '127.0.0.1',
    SMG_WEBSITE_PROXY_SECRET: secret,
    SMG_WEBSITE_LOCAL_URL: `http://127.0.0.1:${String(site.port)}`,
    SMG_WEBSITE_SYNC_TOKEN: site.token,
  };
  const cwd = path.join(REPO_ROOT, 'apps/server');
  const child = spawn(process.execPath, ['--import=tsx', 'src/main.ts'], { cwd, env });
  // Its warnings and errors beside the test's own output.
  child.stdout.on('data', (b: Buffer) => process.stdout.write(`[website server] ${String(b)}`));
  child.stderr.on('data', (b: Buffer) => process.stderr.write(`[website server] ${String(b)}`));
  return child;
}

// The website's nginx; on Linux in the host's network, else on Docker Desktop's port mapping.
function startNginx(site: StubSite, secret: string): void {
  const linux = process.platform === 'linux';
  const host = linux ? '127.0.0.1' : 'host.docker.internal';
  const conf = nginxConf({
    listen: linux ? SITE_PORT : 80,
    app: `${host}:${String(WEBSITE_SERVER_PORT)}`,
    site: `${host}:${String(site.port)}`,
    secret,
  });
  const network = linux
    ? ['--network', 'host']
    : [
        '-p',
        `127.0.0.1:${String(SITE_PORT)}:80`,
        '--add-host',
        'host.docker.internal:host-gateway',
      ];
  // An earlier run cut short may have left this test's own container behind.
  docker(['rm', '-f', CONTAINER]);
  const start =
    'printf "%s" "$SMG_CONF" > /etc/nginx/conf.d/default.conf && exec nginx -g "daemon off;"';
  docker(
    ['run', '-d', '--name', CONTAINER, ...network, '-e', `SMG_CONF=${conf}`, NGINX_IMAGE].concat([
      'sh',
      '-c',
      start,
    ]),
  );
}

async function stopServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null) return;
  const exited = new Promise((done) => server.once('exit', done));
  server.kill();
  await exited;
}

export async function startWebsiteStack(): Promise<WebsiteStack> {
  const dir = mkdtempSync(path.join(tmpdir(), 'smg-website-'));
  const secret = randomBytes(32).toString('hex');
  ensureDatabase();
  viteBuild(path.join(REPO_ROOT, 'apps/web'), path.join(dir, 'web'));
  const site = await startStubSite();
  const server = startServer(site, secret, dir);
  const close = async (): Promise<void> => {
    await stopServer(server);
    docker(['rm', '-f', CONTAINER]);
    await site.close();
    rmSync(dir, { recursive: true, force: true });
  };
  try {
    const alive = () => server.exitCode === null;
    await waitFor(`http://127.0.0.1:${String(WEBSITE_SERVER_PORT)}/readyz`, alive, 'the server');
    startNginx(site, secret);
    await waitFor(`${WEBSITE_URL}/games/mini-games/readyz`, alive, 'the stand-in website');
  } catch (error) {
    await close();
    throw error;
  }
  return { site, close };
}
