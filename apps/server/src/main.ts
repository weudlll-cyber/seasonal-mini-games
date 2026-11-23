/**
 * @file   apps/server/src/main.ts
 * @module server
 * @brief  The server's entry point: starts it (./server) and ends the process on a fatal error.
 *
 * Responsibility: used by `pnpm dev`, `node dist/main.js` and the Dockerfile `server` command;
 *                 everything else is ./server's `startServer`.
 * Depends on:     ./server
 * Used by:        apps/server/package.json "dev" and "start" scripts, build.mjs, Dockerfile
 * Spec:           docs/spec/04-software-architecture.md §2.1
 */
import { startServer } from './server.js';

startServer().catch((error: unknown) => {
  console.error('[smg] fatal:', error);
  process.exit(1);
});
