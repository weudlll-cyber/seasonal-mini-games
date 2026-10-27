/**
 * @file   apps/server/src/http/plugins/securityHeaders.ts
 * @module server/http
 * @brief  Registers helmet with the project's baseline Content Security Policy.
 *
 * Responsibility: hard-set the headers of 03 §7 for every response: CSP (self scripts
 *                 and styles), frame and referrer rules, nosniff and a Permissions-Policy
 *                 that denies camera, microphone, geolocation and payment; `frame-src` admits
 *                 the host chat's origin while the chat provider is hostEmbed; `frame-ancestors`
 *                 admits the embed allowlist (07 §1, Bingo 07 §3.4) except for the admin app, and
 *                 X-Frame-Options is dropped where it would contradict it. HSTS comes from the TLS proxy.
 * Depends on:     @fastify/helmet
 * Used by:        ../app.ts
 * Spec:           Bingo 03 §7, Bingo 05 §1; Bingo 07 §3.4
 */
import type { IncomingMessage } from 'node:http';

import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

// The admin app and its API are never framed by another site.
const ADMIN = /\/admin(\/|\?|$)/;
const isAdminPath = (url: string | undefined) => ADMIN.test(url ?? '');
// Only a plain origin reaches the header, so no stored value can add a directive.
const PLAIN_ORIGIN = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/;

// `frameOrigin`: an extra origin pages may frame (the host's chat room with the provider
// hostEmbed, 07 §2), read per response; '' for none. `embedOrigins`: the sites that may frame
// the game (the embed allowlist), read per response.
export async function registerSecurityHeaders(
  app: FastifyInstance,
  frameOrigin: () => string,
  embedOrigins: () => readonly string[],
): Promise<void> {
  const ancestors = (req: IncomingMessage) =>
    isAdminPath(req.url)
      ? "'self'"
      : ["'self'", ...embedOrigins().filter((o) => PLAIN_ORIGIN.test(o))].join(' ');
  await app.register(helmet, {
    contentSecurityPolicy: {
      // "default-src 'self'" plus explicit directives for the placeholder page. The admin
      // app (apps/admin) will raise its own stricter CSP with frame-ancestors 'none' when
      // its routes are wired (WP-19).
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'frame-ancestors': [ancestors],
        'form-action': ["'self'"],
        'object-src': ["'none'"],
        'img-src': ["'self'", 'data:'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'script-src': ["'self'"],
        'connect-src': ["'self'"],
        'frame-src': [() => frameOrigin() || "'self'"],
      },
    },
    // HSTS is only meaningful behind TLS: the standalone Caddy sends it (ops/Caddyfile).
    strictTransportSecurity: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    xContentTypeOptions: true,
    xFrameOptions: { action: 'sameorigin' },
  });
  // 03 §7: no camera, microphone, location or payment for the game's pages (audit S7).
  app.addHook('onSend', (request, reply, _payload, done) => {
    reply.header('permissions-policy', PERMISSIONS_POLICY);
    // X-Frame-Options knows no list of sites: with an allowlist, frame-ancestors decides alone.
    if (embedOrigins().length > 0 && !isAdminPath(request.raw.url)) {
      reply.removeHeader('x-frame-options');
    }
    done();
  });
}

const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=()';
