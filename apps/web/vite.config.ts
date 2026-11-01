/**
 * @file   apps/web/vite.config.ts
 * @module web
 * @brief  Vite config for the player client; bound to 127.0.0.1:5410 (08 §1.1).
 *
 * Responsibility: run the React dev server on the project's reserved port, proxy /api,
 *                 /ws, the development routes /dev, the embed loader and the handoff redirect to the
 *                 server on 3910, inject the dev-badge port via `define`, keep HMR local, and send
 *                 the server's embed allowlist as `frame-ancestors`, as the server does in production. The build target is
 *                 modern browsers only (ES2023 lib). As the Vitest project config it
 *                 lets tests read motion.css and the design tokens (Vitest skips CSS by
 *                 default).
 * Depends on:     vite, @vitejs/plugin-react
 * Spec:           Bingo 08 §1.1
 */
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const PORT = 5410;
const SERVER = 'http://127.0.0.1:3910';

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

export default defineConfig({
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
    __SMG_DEV_PORT__: JSON.stringify(PORT),
  },
  test: {
    // Tests read these as raw text (reduced motion, token contrast); other CSS is skipped.
    css: { include: [/motion\.css/, /tokens\.css/] },
    // Rendering a whole arena in jsdom takes 0.3 s alone but up to 10 s inside "pnpm verify",
    // beside the simulations and the databases; the 5 s default then failed tests that pass.
    testTimeout: 20_000,
  },
});
