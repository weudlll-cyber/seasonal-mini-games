/**
 * @file   apps/server/src/http/routes/serverPageStyles.ts
 * @module server/http
 * @brief  The stylesheet of the pages the server writes itself.
 *
 * Responsibility: GET /server-pages.css styles the placeholder lobby (body class `lobby`) and
 *                 the page that says the admin app is not installed (`plain`). A file of its
 *                 own because the content security policy allows no inline style (03 §7, T430).
 * Depends on:     fastify (types)
 * Used by:        ../app, ./placeholder, ./webClient
 * Spec:           Bingo 03 §7
 */
import type { FastifyInstance } from 'fastify';

// Relative, so it resolves under a base path from "/" and from "/admin".
export const STYLESHEET_LINK = '<link rel="stylesheet" href="server-pages.css" />';

const CSS = `body.lobby { margin: 0; background: #0f1115; color: #e7ecf3; font-family: system-ui, sans-serif; }
.lobby main { min-height: 100vh; display: grid; place-items: center; padding: 2rem; }
.lobby .card { max-width: 32rem; text-align: center; }
.lobby h1 { margin: 0 0 .5rem; font-weight: 600; letter-spacing: .02em; }
.lobby p { margin: .25rem 0; color: #9aa5b2; }
.lobby a { color: #04aaf7; }
.lobby .badge { position: fixed; left: .75rem; bottom: .75rem; padding: .25rem .5rem;
  font-size: .75rem; background: #04aaf7; color: #0f1115; border-radius: .25rem; }
body.plain { font-family: system-ui, sans-serif; margin: 3rem; }
`;

export function registerServerPageStyles(app: FastifyInstance): void {
  app.get('/server-pages.css', (_request, reply) =>
    reply.header('content-type', 'text/css; charset=utf-8').send(CSS),
  );
}
