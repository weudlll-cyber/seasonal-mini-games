/**
 * @file   apps/server/src/main.ts
 * @module server
 * @brief  Composition root: loads env, migrates the database, starts Fastify and the gateway.
 *
 * Responsibility: single entry point used by `pnpm dev`, `node dist/main.js` and the
 *                 Dockerfile `server` command; attaches the realtime gateway, recovers every
 *                 running round and starts its timers, starts the retention jobs (sessions,
 *                 handoff replay cache, chat messages) and, with SMG_FEATURE_WEBHOOKS, the webhook
 *                 deliveries, and closes everything on SIGINT/SIGTERM (open batches written first).
 *                 The integration tests import buildApp directly.
 * Depends on:     ./config/env, ./db/pool, ./db/migrator, ./http/app, ./auth/retention,
 *                 ./chat/retention, ./integration/webhookDelivery, ./realtime/gateway
 * Used by:        apps/server/package.json "dev" script, Dockerfile
 * Spec:           docs/spec/04-software-architecture.md §2.1, §5.3; Bingo 08 §4
 */
import { startRetention } from './auth/retention.js';
import { startChatRetention } from './chat/retention.js';
import { allowedOrigins, loadEnv } from './config/env.js';
import { startWebhookDelivery } from './integration/webhookDelivery.js';
import { migrate } from './db/migrator.js';
import { createPool } from './db/pool.js';
import { buildApp } from './http/app.js';
import { attachGateway } from './realtime/gateway.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPool(env.DATABASE_URL);
  const applied = await migrate(pool);
  const app = await buildApp({ env, pool });
  if (applied.length > 0) app.fastify.log.info({ migrations: applied }, 'applied migrations');
  const io = attachGateway(app.fastify.server, {
    pool,
    play: app.runtime.play,
    limits: app.runtime.limits,
    chat: app.chat,
    cookieName: app.cookieName,
    allowedOrigins: allowedOrigins(env),
    embeds: app.embeds,
    path: `${env.SMG_BASE_PATH}ws`,
    sessionEnds: app.sessionEnds,
    roomFrameMs: env.SMG_ROOM_FRAME_MS,
    sockets: app.metrics.sockets,
  });
  const recovered = await app.runtime.start();
  if (recovered > 0) app.fastify.log.info({ rounds: recovered }, 'recovered running rounds');
  await app.fastify.listen({ host: env.SMG_HOST, port: env.SMG_PORT });
  const stopRetention = startRetention(pool);
  const stopChatRetention = startChatRetention(pool, app.settings);
  const stopWebhooks = env.SMG_FEATURE_WEBHOOKS ? startWebhookDelivery(app.webhooks) : () => {};
  const shutdown = async (): Promise<void> => {
    stopRetention();
    stopChatRetention();
    stopWebhooks();
    await io.close();
    await app.fastify.close();
    await pool.end();
  };
  process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
  process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));
}

main().catch((error: unknown) => {
  console.error('[smg] fatal:', error);
  process.exit(1);
});
