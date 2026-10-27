/**
 * @file   apps/server/src/http/app.ts
 * @module server/http
 * @brief  Builds the Fastify instance of the server with every plugin and route wired.
 *
 * Responsibility: wire logging, security headers, problem-details, health, metrics, the
 *                 built client and admin app (image) or the placeholder page (development),
 *                 sessions and auth, password change, two-factor sign-in with the step-up gate
 *                 of admin writes, the admin routes (settings documents with every game's
 *                 document and their history, audit log, accounts, abuse signals, live rounds
 *                 with staff actions), the match and round
 *                 routes with their runtime, the boards (leaderboards, profiles, adjustments),
 *                 the builtin chat with its moderation and, in development, the Quick Test
 *                 onto a fresh Fastify instance, under the base
 *                 path (SMG_BASE_PATH) and behind the trusted proxies. The caller owns the
 *                 lifecycle (listen, close, pool disposal). Adapted from Bingo's app.ts.
 * Depends on:     fastify, @smg/application, @smg/contracts, ../db/pool, ../auth/*, ../chat/*,
 *                 ../config/*, ../admin/*, ../round/runtime, ./plugins/*, ./routes/*
 * Used by:        ../main.ts, test/*, ../index
 * Spec:           docs/spec/04-software-architecture.md §2.1; docs/spec/06-data-model-api-realtime.md §3
 */
import { SettingsService } from '@smg/application';
import { PLATFORM_SETTINGS } from '@smg/contracts';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { PgAuditLog } from '../admin/pgAuditLog.js';
import { PgSettingsStore } from '../admin/pgSettingsStore.js';
import { SessionEnds } from '../auth/sessionEnds.js';
import { cookieConfig, registerSessions } from '../auth/sessionPlugin.js';
import { createChat, type Chat } from '../chat/chat.js';
import { hostChatOrigin } from '../chat/provider.js';
import type { Env } from '../config/env.js';
import { featuresFrom } from '../config/features.js';
import type { DbPool } from '../db/pool.js';
import { createRoundRuntime, gameDocuments, type RoundRuntime } from '../round/runtime.js';
import { registerProblemDetails } from './plugins/problem.js';
import { registerSecurityHeaders } from './plugins/securityHeaders.js';
import { registerAdminAccounts } from './routes/adminAccounts.js';
import { registerAdminAudit } from './routes/adminAudit.js';
import { registerAdminRounds } from './routes/adminRounds.js';
import { registerAdminSettings } from './routes/adminSettings.js';
import { registerLeaderboardRoutes } from './routes/leaderboards.js';
import { registerMatchRoutes } from './routes/matches.js';
import { registerQuickTest } from './routes/quickTest.js';
import { registerRoundRoutes } from './routes/rounds.js';
import { registerSeasonRoutes } from './routes/seasons.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerChatRoutes } from './routes/chat.js';
import { registerDevSignIn } from './routes/devSignIn.js';
import { registerHealth } from './routes/health.js';
import { createMetrics, registerMetrics, type MetricsHandle } from './routes/metrics.js';
import { registerPasswordChange } from './routes/password.js';
import { registerPlaceholder } from './routes/placeholder.js';
import { registerTwoFactor } from './routes/twoFactor.js';
import { registerWebClient } from './routes/webClient.js';

interface AppDeps {
  readonly env: Env;
  readonly pool: DbPool;
}

export interface App {
  readonly fastify: FastifyInstance;
  readonly metrics: MetricsHandle;
  readonly settings: SettingsService;
  readonly audit: PgAuditLog;
  // Ended sessions (logout, suspension, password change): the gateway closes their sockets.
  readonly sessionEnds: SessionEnds;
  // Rounds, matches and their timers; started with `runtime.start()`, stopped on close.
  readonly runtime: RoundRuntime;
  // The builtin chat; the gateway sends its events.
  readonly chat: Chat;
  readonly cookieName: string;
}

// Fastify with the logger, the trusted proxies (Caddy) and the base path: behind the website
// the app lives under /games/mini-games/ and the routes see the path without it.
function createFastify(env: Env): FastifyInstance {
  // Fastify builds the pino logger from this options object; passing a pre-made pino
  // instance would widen generics in a way exactOptionalPropertyTypes rejects.
  const loggerOptions: FastifyServerOptions['logger'] =
    env.NODE_ENV === 'test'
      ? false
      : {
          level: env.SMG_LOG_LEVEL,
          // Secrets and seeds never reach a log line (05 §3).
          redact: ['req.headers.cookie', 'req.headers["x-csrf-token"]', '*.seed', '*.secret'],
          ...(env.SMG_DEV
            ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
            : {}),
        };
  const proxies = env.SMG_TRUSTED_PROXIES;
  return Fastify({
    logger: loggerOptions,
    disableRequestLogging: env.NODE_ENV === 'test',
    trustProxy: proxies.length > 0 ? proxies : false,
    rewriteUrl: (request) => withoutBase(request.url ?? '/', env.SMG_BASE_PATH),
  });
}

export async function buildApp(deps: AppDeps): Promise<App> {
  const fastify = createFastify(deps.env);
  // Development features only with SMG_DEV=1 (fail closed).
  const isDev = deps.env.SMG_DEV;
  const audit = new PgAuditLog(deps.pool);
  const documents = { ...PLATFORM_SETTINGS, ...gameDocuments() };
  const settings = new SettingsService(documents, new PgSettingsStore(deps.pool), audit);
  // The CSP lets the host's chat room load in a frame while the provider is hostEmbed.
  await registerSecurityHeaders(fastify, hostChatOrigin(settings));
  registerProblemDetails(fastify);
  const metrics = createMetrics();
  registerMetrics(fastify, metrics);
  registerHealth(fastify, deps.pool);
  // The built client in the image; the placeholder page in development (Vite serves it).
  if (deps.env.SMG_WEB_DIR === undefined) {
    registerPlaceholder(fastify, { dev: isDev, port: deps.env.SMG_PORT });
  } else {
    registerWebClient(fastify, deps.env.SMG_WEB_DIR, deps.env.SMG_ADMIN_DIR);
  }
  const cookie = cookieConfig(!isDev, deps.env.SMG_BASE_PATH);
  const sessionEnds = new SessionEnds();
  await registerSessions(fastify, deps.pool, cookie);
  registerAuthRoutes(fastify, {
    pool: deps.pool,
    cookie,
    features: featuresFrom(deps.env),
    sessionEnds,
  });
  registerPasswordChange(fastify, { pool: deps.pool, sessionEnds });
  // Development only: quick sign-in as host or player (never in a production build).
  if (isDev) registerDevSignIn(fastify, { pool: deps.pool, cookie, sessionEnds });
  registerTwoFactor(fastify, {
    pool: deps.pool,
    env: deps.env,
    features: featuresFrom(deps.env),
    audit,
  });
  registerAdminSettings(fastify, settings, deps.pool);
  registerAdminAudit(fastify, audit);
  registerAdminAccounts(fastify, { pool: deps.pool, audit, sessionEnds });
  const runtime = createRoundRuntime(deps.env, deps.pool, settings);
  const { play, limits, store } = runtime;
  registerMatchRoutes(fastify, { play, settings, pool: deps.pool });
  registerRoundRoutes(fastify, { play, limits, store, pool: deps.pool });
  registerSeasonRoutes(fastify, { pool: deps.pool, seasons: runtime.seasons, audit });
  registerLeaderboardRoutes(fastify, { pool: deps.pool, audit });
  registerAdminRounds(fastify, { play, pool: deps.pool, audit, settings });
  const chat = createChat(deps.pool, settings, runtime.rounds);
  registerChatRoutes(fastify, { chat, audit });
  if (isDev) registerQuickTest(fastify, { play, pool: deps.pool });
  fastify.addHook('onClose', () => runtime.stop());
  return { fastify, metrics, settings, audit, sessionEnds, runtime, chat, cookieName: cookie.name };
}

// "/games/mini-games/api/v1/x" → "/api/v1/x" when the base path is "/games/mini-games/".
function withoutBase(url: string, base: string): string {
  if (base === '/') return url;
  if (url === base.slice(0, -1)) return '/';
  return url.startsWith(base) ? url.slice(base.length - 1) : url;
}
