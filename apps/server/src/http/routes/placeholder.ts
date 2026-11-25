/**
 * @file   apps/server/src/http/routes/placeholder.ts
 * @module server/http
 * @brief  Placeholder lobby HTML page served while the real client bundles are empty.
 *
 * Responsibility: answer GET / with a minimal page the owner can open in the browser
 *                 after `pnpm dev`. In development the dev badge "Mini Games · dev · <port>"
 *                 is embedded (08 §1.1); in production the badge is left out.
 * Depends on:     fastify, ./serverPageStyles
 * Used by:        ../app.ts
 * Spec:           docs/spec/10-repository-structure.md §4; Bingo 08 §1.1
 */
import type { FastifyInstance } from 'fastify';

import { STYLESHEET_LINK } from './serverPageStyles.js';

interface PlaceholderOptions {
  readonly dev: boolean;
  readonly port: number;
}

export function registerPlaceholder(app: FastifyInstance, options: PlaceholderOptions): void {
  const html = renderPage(options);
  app.get('/', async (_request, reply) => {
    return reply.header('content-type', 'text/html; charset=utf-8').send(html);
  });
}

function renderPage(options: PlaceholderOptions): string {
  const badge = options.dev ? renderBadge(options.port) : '';
  // Content is intentionally minimal: the player client is a separate app.
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Seasonal Mini Games</title>
  ${STYLESHEET_LINK}
</head>
<body class="lobby">
  <main>
    <section class="card">
      <h1>Seasonal Mini Games</h1>
      <p>Server is up. In development the player client runs on port 5410.</p>
      <p><a href="/healthz">/healthz</a> &middot;
         <a href="/readyz">/readyz</a> &middot;
         <a href="/metrics">/metrics</a></p>
    </section>
  </main>
  ${badge}
</body>
</html>`;
}

function renderBadge(port: number): string {
  return `<div class="badge" aria-label="Development build badge">Mini Games &middot; dev &middot; ${String(port)}</div>`;
}
