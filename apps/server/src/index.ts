/**
 * @file   apps/server/src/index.ts
 * @module server
 * @brief  Public entry point of @smg/server, re-exports what tests and tooling import.
 *
 * Responsibility: expose the pieces integration tests compose (buildApp, loadEnv,
 *                 createPool, migrate, attachGateway). The actual CLI entry
 *                 is ./main.ts and is run from the Dockerfile and `pnpm dev`.
 * Depends on:     ./config/env, ./db/pool, ./db/migrator, ./http/app, ./realtime/gateway
 * Used by:        ../test/harness and the integration tests
 * Spec:           Bingo 02 §3
 */

export { loadEnv } from './config/env.js';
export { createPool, type DbPool } from './db/pool.js';
export { migrate } from './db/migrator.js';
export { buildApp, type App } from './http/app.js';
export { attachGateway } from './realtime/gateway.js';
