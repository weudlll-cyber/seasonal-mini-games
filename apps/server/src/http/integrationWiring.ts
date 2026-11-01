/**
 * @file   apps/server/src/http/integrationWiring.ts
 * @module server/http
 * @brief  Wires the integration of 07 §1 onto the app: handoff, embed, public API, webhooks.
 *
 * Responsibility: the provider keys (JWKS through the SSRF-safe client), the handoff and its
 *                 redirect form, the embed loader and the client's embed config, the public read
 *                 API, the admin's allowlist, provider and webhook routes, and, with
 *                 SMG_FEATURE_WEBHOOKS, the lifecycle events queued for delivery. The delivery
 *                 loop itself is started by ../main (as the retention jobs), so tests drive it.
 * Depends on:     fastify, @smg/application (audit), ../config/*, ../integration/*, ../round/runtime,
 *                 ../seasons/safeFetch, ../dev/embedLoader (development only), ./routes/*
 * Used by:        ./app
 * Spec:           docs/spec/07-integration.md §1, §3.2, §4; Bingo 07 §2.2, §3, §5, §7
 */
import type { AuditLog } from '@smg/application';
import type { FastifyInstance } from 'fastify';

import type { SessionEnds } from '../auth/sessionEnds.js';
import type { CookieConfig } from '../auth/sessionPlugin.js';
import { allowedOrigins, type Env } from '../config/env.js';
import type { Features } from '../config/features.js';
import { derivedKey, roundKeyFrom } from '../config/roundKey.js';
import type { DbPool } from '../db/pool.js';
import { devEmbedScript } from '../dev/embedLoader.js';
import type { EmbedAllowlist } from '../integration/embedOrigins.js';
import { ProviderKeys } from '../integration/keys.js';
import { safePost } from '../integration/safePost.js';
import { WebhookDelivery } from '../integration/webhookDelivery.js';
import { queueLifecycleWebhooks } from '../integration/webhookEvents.js';
import { WebhookStore } from '../integration/webhooks.js';
import type { RoundRuntime } from '../round/runtime.js';
import { safeFetchJson } from '../seasons/safeFetch.js';
import { registerAdminIntegration } from './routes/adminIntegration.js';
import { registerAdminWebhooks } from './routes/adminWebhooks.js';
import { bundledEmbedScript, registerEmbedRoutes } from './routes/embed.js';
import { registerHandoffRoutes } from './routes/handoff.js';
import { registerPublicApi } from './routes/publicApi.js';

interface IntegrationDeps {
  readonly env: Env;
  readonly pool: DbPool;
  readonly features: Features;
  readonly embeds: EmbedAllowlist;
  readonly audit: AuditLog;
  readonly cookie: CookieConfig;
  readonly sessionEnds: SessionEnds;
  readonly runtime: RoundRuntime;
}

// The webhook deliveries; ../main runs them while the feature is on.
export function registerIntegration(app: FastifyInstance, deps: IntegrationDeps): WebhookDelivery {
  const { env, pool, embeds, audit } = deps;
  // Development only: a local JWKS or receiver on a private address (as SMG_DEV_FEED_URL).
  const allowLocal = env.SMG_DEV;
  const keys = new ProviderKeys((url) => safeFetchJson(url, { allowLocal }));
  registerHandoffRoutes(app, {
    pool,
    keys,
    embeds,
    ownOrigins: allowedOrigins(env),
    cookie: deps.cookie,
    sessionEnds: deps.sessionEnds,
  });
  registerEmbedRoutes(app, { embeds, script: env.SMG_DEV ? devEmbedScript : bundledEmbedScript });
  registerPublicApi(app, { pool, embeds, rounds: deps.runtime.rounds });
  registerAdminIntegration(app, { pool, embeds, audit });
  const store = new WebhookStore(pool, derivedKey(roundKeyFrom(env), 'smg webhook secrets'));
  registerAdminWebhooks(app, { store, audit, enabled: deps.features.webhooks });
  if (deps.features.webhooks) queueLifecycleWebhooks(store, deps.runtime.play);
  return new WebhookDelivery(store, (url, body, headers) =>
    safePost(url, body, headers, { allowLocal }),
  );
}
