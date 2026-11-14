/**
 * @file   apps/web/vite.config.ts
 * @module web
 * @brief  Vite config for the player client; bound to 127.0.0.1:5410 (08 §1.1).
 *
 * Responsibility: run the React dev server on the project's reserved port, proxy /api,
 *                 /ws, the development routes /dev, the embed loader and the handoff redirect to the
 *                 server on 3910 (a browser-test run passes its own port and server in
 *                 SMG_VITE_PORT and SMG_VITE_SERVER, 09 §1.1), inject the build badge's values
 *                 via `define` (`buildInfo`), keep HMR local, and send
 *                 the server's embed allowlist as `frame-ancestors`, as the server does in production. The build target is
 *                 modern browsers only (ES2023 lib). As the Vitest project config it
 *                 lets tests read motion.css and the design tokens (Vitest skips CSS by
 *                 default).
 * Depends on:     vite, @vitejs/plugin-react, node:child_process, git
 * Spec:           Bingo 08 §1.1
 */
/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// `pnpm dev`'s port and server; Playwright's run sets its own (e2e/testStack).
const PORT = Number(process.env['SMG_VITE_PORT'] ?? 5410);
const SERVER = process.env['SMG_VITE_SERVER'] ?? 'http://127.0.0.1:3910';

// One git answer, or null without git (a Docker build has no .git: it passes SMG_BUILD_COMMIT).
function git(args: readonly string[]): string | null {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

// The build badge's values (src/shell/BuildBadge): the short commit and the day of the build
// (in `vite dev`, of the dev server's start), and in `vite dev` the branch (DECISIONS T346).
function buildInfo(dev: boolean): { commit: string; date: string; branch: string | null } {
  const commit = process.env['SMG_BUILD_COMMIT'] ?? git(['rev-parse', '--short', 'HEAD']);
  return {
    commit: commit === null || commit === '' ? 'unknown' : commit.slice(0, 7),
    date: process.env['SMG_BUILD_DATE'] ?? new Date().toISOString().slice(0, 10),
    // A checkout without a branch (CI's pull-request merge) says so.
    branch: dev ? git(['branch', '--show-current']) || 'detached HEAD' : null,
  };
}

// Development only: the dev server's pages may be framed only by the sites on the server's
// embed allowlist (07 §1); without an answer, by none but itself (fail closed).
function frameAncestors(): Plugin {
  const allowlist = async (): Promise<string> => {
    try {
      const r = await fetch(`${SERVER}/api/v1/public/embed-config`);
      const config = (await r.json()) as { origins?: unknown };
      const origins = Array.isArray(config.origins) ? config.origins : [];
      return origins
        .filter((o): o is string => typeof o === 'string' && /^https?:\/\/[\w.:-]+$/.test(o))
        .join(' ');
    } catch {
      return '';
    }
  };
  return {
    name: 'smg-frame-ancestors',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        // Only pages can be framed; modules and assets pass untouched.
        if (!(request.headers.accept ?? '').includes('text/html')) {
          next();
          return;
        }
        void allowlist().then((origins) => {
          response.setHeader('content-security-policy', `frame-ancestors 'self' ${origins}`.trim());
          next();
        });
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  // Relative asset paths: one build serves at "/" or under "/games/mini-games/" (09 §1).
  base: './',
  plugins: [react(), frameAncestors()],
  server: {
    host: '127.0.0.1',
    port: PORT,
    strictPort: true,
    // The real game talks to the server through the client origin, so the session cookie
    // is first-party and the WebSocket Origin check sees this port (03 §3, 06 §2).
    proxy: {
      '/api': { target: SERVER, changeOrigin: false },
      '/ws': { target: SERVER, ws: true, changeOrigin: false },
      // Development routes (Quick Test); the server registers them only with SMG_DEV=1.
      '/dev': { target: SERVER, changeOrigin: false },
      // The loader host pages include, and the one-time handoff redirect (07 §1).
      '/embed.js': { target: SERVER, changeOrigin: false },
      '/auth/handoff': { target: SERVER, changeOrigin: false },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: PORT,
    strictPort: true,
  },
  define: {
    __SMG_BUILD__: JSON.stringify(buildInfo(command === 'serve')),
  },
  test: {
    // Tests read these as raw text (reduced motion, token contrast); other CSS is skipped.
    css: { include: [/motion\.css/, /tokens\.css/] },
    // Rendering a whole arena in jsdom takes 0.3 s alone but up to 10 s inside "pnpm verify",
    // beside the simulations and the databases; the 5 s default then failed tests that pass.
    testTimeout: 20_000,
  },
}));
