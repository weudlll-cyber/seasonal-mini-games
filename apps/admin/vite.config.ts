/**
 * @file   apps/admin/vite.config.ts
 * @module admin
 * @brief  Vite config of the admin app: React, the local port 5411, the API through the server.
 *
 * Responsibility: serve the admin app on its project port (10 §4) and pass /api to the
 *                 server on 3910, so the session cookie stays first-party; relative asset
 *                 paths so one build serves at "/" or under a base path. Tests run in jsdom
 *                 where a file asks for it.
 * Depends on:     vite, @vitejs/plugin-react
 * Spec:           docs/spec/10-repository-structure.md §4; docs/spec/08-admin-settings.md §1
 */
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const PORT = 5411;
const SERVER = 'http://127.0.0.1:3910';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: PORT,
    strictPort: true,
    proxy: { '/api': { target: SERVER, changeOrigin: false } },
  },
  preview: { host: '127.0.0.1', port: PORT, strictPort: true },
  test: { css: false },
});
