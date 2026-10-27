/**
 * @file   apps/server/src/http/routes/embed.ts
 * @module server/http
 * @brief  What an embedding page loads: the loader `embed.js`, and the allowlist the game's
 *         own frame checks messages against.
 *
 * Responsibility: `GET /embed.js` (apps/embed-loader, built into the server bundle; built on the
 *                 fly in development) with `Cross-Origin-Resource-Policy: cross-origin`, since host
 *                 pages load it from their own origin; `GET /api/v1/public/embed-config`: the
 *                 allowed origins and those that may hand off a sign-in (Bingo 07 §3.3, §3.4).
 * Depends on:     node:fs/promises, node:path, node:url, fastify, ../../integration/embedOrigins
 * Used by:        ../app
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §3.2–§3.4
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyInstance } from 'fastify';

import type { EmbedAllowlist } from '../../integration/embedOrigins.js';

// The loader next to the production bundle (apps/server/build.mjs writes dist/public/embed.js);
// null when the server runs from its sources without a build.
export async function bundledEmbedScript(): Promise<string | null> {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public', 'embed.js');
  return readFile(file, 'utf8').catch(() => null);
}

export function registerEmbedRoutes(
  app: FastifyInstance,
  deps: { readonly embeds: EmbedAllowlist; readonly script: () => Promise<string | null> },
): void {
  app.get('/embed.js', async (_request, reply) => {
    const script = await deps.script();
    if (script === null) return reply.status(404).send({ code: 'NOT_FOUND' });
    return reply
      .header('content-type', 'text/javascript; charset=utf-8')
      .header('cross-origin-resource-policy', 'cross-origin')
      .header('cache-control', 'public, max-age=300')
      .send(script);
  });

  app.get('/api/v1/public/embed-config', (_request, reply) =>
    reply.header('cache-control', 'no-store').send(deps.embeds.config()),
  );
}
