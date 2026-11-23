/**
 * @file   apps/server/test/productionBundle.test.ts
 * @module server/test
 * @brief  The production builds of server, player client and admin app carry no development
 *         code and no developer comments.
 *
 * Responsibility: build the server bundle (build.mjs), the player client and the admin app
 *                 (vite build) into temporary folders and fail when any shipped file (source maps
 *                 aside: they quote the sources, comments included) contains a marker of
 *                 development code: the Quick Test route or page, the dev sign-in menu,
 *                 or the development server address; and the server bundle imports no
 *                 workspace package (@smg/*, @smg-game/*), which the image does not ship.
 *                 The pages and the kit's early theme script, which Vite and the kit's
 *                 themeInit() would ship as they are, hold no comment (owner decision O128,
 *                 ../../web/productionFiles).
 * Depends on:     vitest, node:child_process, node:fs
 * Spec:           Bingo 09 §1; Bingo 03 §13
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

const DEV_MARKERS = ['dev/quicktest', 'dev-sign-in', 'Quick Test', '127.0.0.1:3910'];
const SERVER_DIR = path.resolve(import.meta.dirname, '..');
const WEB_DIR = path.resolve(SERVER_DIR, '../web');
const ADMIN_DIR = path.resolve(SERVER_DIR, '../admin');
// A developer comment in HTML, CSS or JavaScript.
const COMMENT = /<!--|\/\*|^\s*\/\//m;
const out = mkdtempSync(path.join(tmpdir(), 'smg-bundle-'));

afterAll(() => {
  rmSync(out, { recursive: true, force: true });
});

// As the Dockerfile builds: Vitest's NODE_ENV=test would make Vite build in development mode.
function run(cwd: string, args: readonly string[]): void {
  const env = { ...process.env, NODE_ENV: 'production' };
  const result = spawnSync(process.execPath, args, { cwd, env, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
}

// An app's production build into <out>/<name>; its folder.
function viteBuild(appDir: string, name: string): string {
  const dir = path.join(out, name);
  const vite = path.join(appDir, 'node_modules/vite/bin/vite.js');
  run(appDir, [vite, 'build', '--outDir', dir, '--emptyOutDir', '--logLevel', 'error']);
  expect(readdirSync(dir)).toContain('index.html');
  return dir;
}

const text = (dir: string, file: string) => readFileSync(path.join(dir, file), 'utf8');

// "file: marker" for every shipped file below <dir> that holds a marker.
function devMarkersIn(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name.endsWith('.map')) continue;
    const file = path.join(entry.parentPath, entry.name);
    const text = readFileSync(file, 'latin1');
    for (const marker of DEV_MARKERS) {
      if (text.includes(marker)) found.push(`${path.relative(dir, file)}: ${marker}`);
    }
  }
  return found;
}

describe('production bundles', () => {
  it('leave the development modules out of the server bundle', () => {
    const dir = path.join(out, 'server');
    run(SERVER_DIR, ['build.mjs', dir]);
    expect(readdirSync(dir)).toContain('main.js');
    expect(devMarkersIn(dir)).toEqual([]);
    // The image ships no workspace package: each must be inside the bundle (a game's sources
    // are TypeScript, which Node refuses to load from node_modules; found by the installer test).
    for (const entry of ['main.js', 'cli.js']) {
      const text = readFileSync(path.join(dir, entry), 'utf8');
      expect(text, entry).not.toMatch(/from\s*["']@smg(-game)?\//);
    }
  }, 60_000);

  it('leave Quick Test, the dev sign-in and the dev server address out of the client', () => {
    const dir = viteBuild(WEB_DIR, 'web');
    expect(devMarkersIn(dir)).toEqual([]);
    expect(text(dir, 'index.html')).not.toMatch(COMMENT);
    expect(text(dir, 'theme-init.js')).not.toMatch(COMMENT);
    // Still the theme script: minified, not emptied.
    expect(text(dir, 'theme-init.js')).toContain('data-theme');
  }, 120_000);

  it('ship the admin page without its comments', () => {
    const dir = viteBuild(ADMIN_DIR, 'admin');
    expect(text(dir, 'index.html')).not.toMatch(COMMENT);
  }, 120_000);
});
