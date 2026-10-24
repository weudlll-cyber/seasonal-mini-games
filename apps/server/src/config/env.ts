/**
 * @file   apps/server/src/config/env.ts
 * @module server/config
 * @brief  Validates runtime environment variables at startup.
 *
 * Responsibility: parse process.env with a strict zod schema, exit with a readable
 *                 message on invalid or missing values, expose a typed Env object; the
 *                 deployment settings (base path, public URL, trusted proxies, client and
 *                 data directories, 09 §1) and the WebSocket origins derived from them.
 *                 Fail closed: NODE_ENV defaults to production and development features
 *                 need SMG_DEV=1, which is refused for a public (non-localhost) address.
 * Depends on:     zod
 * Used by:        ../main.ts, ../http/app.ts, ../cli, ./features, ../index
 * Spec:           docs/spec/10-repository-structure.md §4, §5; Bingo 08 §1.1, §5
 */
import { z } from 'zod';

// The port range stays open so test runs can bind to an ephemeral port (0 → kernel picks).
// Local dev uses the fixed project port 3910 (10 §4).
const envSchema = z.object({
  // Fail closed: without NODE_ENV the server runs as production.
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  // Development features (quick sign-in, Quick Test, fast test rules, bots, system-abort
  // route, load accounts, a cookie without Secure) exist only with SMG_DEV=1 (audit S1).
  SMG_DEV: z.stringbool().default(false),
  SMG_HOST: z.string().min(1).default('127.0.0.1'),
  SMG_PORT: z.coerce.number().int().min(0).max(65535).default(3910),
  // One libpq URL; the integration test overrides it with the Testcontainers URL.
  DATABASE_URL: z.url(),
  SMG_LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  // Feature flags (./features): e-mail verification and 2FA off, guests on.
  SMG_FEATURE_EMAIL_VERIFICATION: z.stringbool().default(false),
  SMG_FEATURE_TWO_FACTOR: z.stringbool().default(false),
  SMG_FEATURE_GUESTS: z.stringbool().default(true),
  // Browser origins allowed to open the WebSocket (06 §2), comma-separated; without it the
  // public URL's origin, else the local player and admin clients (allowedOrigins below).
  SMG_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((v) =>
      v
        ?.split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0),
    ),
  // Where the app is reachable: "/" standalone, "/games/mini-games/" inside the website (09 §1).
  SMG_BASE_PATH: z
    .string()
    .regex(/^\/([\w-]+\/)*$/, 'starts and ends with "/", e.g. /games/mini-games/')
    .default('/'),
  // The public address (https://games.example.org/); its origin may open the WebSocket.
  SMG_PUBLIC_URL: z.url().optional(),
  // Proxies whose X-Forwarded-For is believed (Caddy's address); none by default.
  SMG_TRUSTED_PROXIES: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
    ),
  // The built player client (index.html, assets/); the image sets it, development has none.
  SMG_WEB_DIR: z.string().optional(),
  // A writable directory (the uploads volume in production) for the maintenance flag.
  SMG_DATA_DIR: z.string().default('./data'),
  // Seals round seeds at rest (AES-256-GCM, 05 §3); 64 hex characters, required outside
  // development and tests (./roundKey).
  SMG_ROUND_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, '64 hex characters')
    .optional(),
  // Group commit of the round actor (04 §5.3, 08 §7) and the scheduler's poll interval.
  SMG_ENGINE_BATCH_MS: z.coerce.number().int().min(5).max(100).default(20),
  SMG_ENGINE_BATCH_MAX: z.coerce.number().int().min(50).max(1_000).default(200),
  SMG_SCHEDULER_POLL_MS: z.coerce.number().int().min(50).max(1_000).default(100),
  // Development only (with SMG_DEV=1): a local In Season feed, plain HTTP allowed, used instead
  // of the `seasons.feedUrl` setting (which takes https addresses only).
  SMG_DEV_FEED_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

const DEV_ORIGINS = [
  'http://localhost:5410',
  'http://127.0.0.1:5410',
  'http://localhost:5411',
  'http://127.0.0.1:5411',
];

// The origins allowed to open the WebSocket: the list given, else the public URL's, else
// the local development clients.
export function allowedOrigins(env: Env): readonly string[] {
  if (env.SMG_ALLOWED_ORIGINS !== undefined) return env.SMG_ALLOWED_ORIGINS;
  if (env.SMG_PUBLIC_URL !== undefined) return [new URL(env.SMG_PUBLIC_URL).origin];
  return DEV_ORIGINS;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// Development features on a public address would be an open door: refuse to start.
function checkDevSafe(env: Env): Env {
  if (env.SMG_DEV && env.SMG_PUBLIC_URL !== undefined) {
    const host = new URL(env.SMG_PUBLIC_URL).hostname;
    if (!LOCAL_HOSTS.has(host)) {
      throw new Error(
        `SMG_DEV=1 is refused for the public address ${host}: development features stay on localhost`,
      );
    }
  }
  return env;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return checkDevSafe(parsed.data);
  // Keep the message compact — users running `pnpm dev` without a .env file need the hint,
  // not a wall of zod issues.
  const issues = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment:\n${issues}`);
}
