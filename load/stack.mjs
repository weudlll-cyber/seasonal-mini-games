/**
 * @file   load/stack.mjs
 * @module load
 * @brief  The load check's own server: port 3950 on a fresh database smg_load.
 *
 * Responsibility: `withLoadStack(work)` starts the test server (apps/server/tools/testServer:
 *                 the development PostgreSQL, the database smg_load recreated empty and
 *                 migrated, the development features on) on 3950, waits for /readyz, runs
 *                 `work` and stops the server whatever happened, waiting for it to exit. With
 *                 `SMG_LOAD_CPU_PROF` set to a directory the server runs under V8's CPU profiler
 *                 and writes its profile there when it exits (09 §5). The developer's `pnpm dev`
 *                 (3910, database smg) and a browser-test run (3940, smg_test) are never used
 *                 or touched (docs/spec/09-testing-strategy.md §1.1, DECISIONS T345).
 * Depends on:     node:child_process, node:fs, ops/.env.dev.example, apps/server (test-server)
 * Used by:        ./guessStorm, ./parallelStorm, ./mindStorm, ./http
 * Spec:           docs/spec/09-testing-strategy.md §1.1, §5
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const LOAD_PORT = 3950;
// The Origin the load clients send; no page is served there, the server only allows it.
export const LOAD_ORIGIN = 'http://localhost:5450';

// The development PostgreSQL's credentials and port, from its env file.
function databaseUrl() {
  const text = readFileSync(new URL('../ops/.env.dev.example', import.meta.url), 'utf8');
  const env = new Map(
    text
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
  const user = encodeURIComponent(env.get('POSTGRES_USER'));
  const password = encodeURIComponent(env.get('POSTGRES_PASSWORD'));
  return `postgres://${user}:${password}@127.0.0.1:${env.get('SMG_DEV_POSTGRES_PORT')}/smg_load`;
}

async function ready(server) {
  const end = Date.now() + 120_000;
  while (Date.now() < end && server.exitCode === null) {
    const ok = await fetch(`http://127.0.0.1:${LOAD_PORT}/readyz`).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`the load server did not answer on ${LOAD_PORT}`);
}

// The server's own process, profiled when SMG_LOAD_CPU_PROF names a directory.
function serverArgs() {
  const dir = process.env.SMG_LOAD_CPU_PROF;
  const prof = dir ? ['--cpu-prof', `--cpu-prof-dir=${dir}`] : [];
  return [...prof, '--import=tsx', 'tools/testServer.ts'];
}

export async function withLoadStack(work) {
  const server = spawn(process.execPath, serverArgs(), {
    cwd: fileURLToPath(new URL('../apps/server', import.meta.url)),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl(),
      SMG_PORT: String(LOAD_PORT),
      SMG_ALLOWED_ORIGINS: LOAD_ORIGIN,
      SMG_LOG_LEVEL: 'warn',
      SMG_DEV: '1',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  try {
    await ready(server);
    return await work();
  } finally {
    // SIGTERM: the server closes and exits by itself, writing a profile on its way out.
    const exited =
      server.exitCode === null ? new Promise((done) => server.once('exit', done)) : null;
    server.kill();
    if (exited !== null) await Promise.race([exited, new Promise((d) => setTimeout(d, 30_000))]);
  }
}
