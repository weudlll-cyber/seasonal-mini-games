/**
 * @file   apps/server/src/http/routes/cors.ts
 * @module server/http
 * @brief  CORS for the few routes a host page may call: the handoff and the public read API.
 *
 * Responsibility: answer an allowed Origin with itself (never `*`), with credentials only where
 *                 the route sets a cookie, and always `Vary: Origin` so a cache never serves one
 *                 site's answer to another; a preflight for a JSON POST. Which origins are allowed
 *                 is the caller's (the embed allowlist, Bingo 07 §3.4).
 * Depends on:     fastify
 * Used by:        ./handoff, ./publicApi
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §3.4, §7
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// True when the request's Origin is allowed and the answer now carries the CORS headers.
export function allowCors(
  request: FastifyRequest,
  reply: FastifyReply,
  allowed: (origin: string) => boolean,
  credentials: boolean,
): boolean {
  void reply.header('vary', 'Origin');
  const origin = request.headers.origin;
  if (origin === undefined || !allowed(origin)) return false;
  void reply.header('access-control-allow-origin', origin);
  if (credentials) void reply.header('access-control-allow-credentials', 'true');
  return true;
}

// The preflight of a JSON POST with credentials from an allowed origin; 403 for any other.
export function registerPreflight(
  app: FastifyInstance,
  path: string,
  allowed: (origin: string) => boolean,
): void {
  app.options(path, (request, reply) => {
    if (!allowCors(request, reply, allowed, true)) {
      return reply.status(403).send({ code: 'ORIGIN_NOT_ALLOWED' });
    }
    return reply
      .header('access-control-allow-methods', 'POST')
      .header('access-control-allow-headers', 'content-type')
      .header('access-control-max-age', '600')
      .status(204)
      .send();
  });
}
