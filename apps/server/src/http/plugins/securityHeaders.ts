/**
 * @file   apps/server/src/http/plugins/securityHeaders.ts
 * @module server/http
 * @brief  Registers helmet with the project's baseline Content Security Policy.
 *
 * Responsibility: hard-set the headers of 03 §7 for every response: CSP (self scripts
 *                 and styles), frame and referrer rules, nosniff and a Permissions-Policy
 *                 that denies camera, microphone, geolocation and payment; `frame-src` admits
 *                 the host chat while the chat provider is hostEmbed, else 'self'; in website
 *                 mode only the website's own `/embed/chat` (by path, 07 §2), else 'none';
 *                 `frame-ancestors`
 *                 admits the embed allowlist (07 §1, Bingo 07 §3.4), and X-Frame-Options is
 *                 dropped where it would contradict it; the admin app is framed by nobody
 *                 (`frame-ancestors 'none'`, X-Frame-Options DENY) and requires Trusted Types
 *                 for scripts (`require-trusted-types-for 'script'`, enforced since the built
 *                 app was checked in Chromium, DECISIONS T178); fonts only from this origin.
 *                 HSTS comes from the TLS proxy.
 * Depends on:     @fastify/helmet
 * Used by:        ../app.ts
 * Spec:           Bingo 03 §7, Bingo 05 §1; Bingo 07 §3.4, §6; docs/spec/07-integration.md §2
 */
import type { IncomingMessage } from 'node:http';

import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

// The admin app and its API are never framed by another site.
const ADMIN = /\/admin(\/|\?|$)/;
const isAdminPath = (url: string | undefined) => ADMIN.test(url ?? '');
// Only a plain origin reaches the header, so no stored value can add a directive.
const PLAIN_ORIGIN = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/;

export interface FrameRules {
  // The host's chat room pages may frame with the provider hostEmbed (07 §2), read per
  // response: an origin, or the website's room as origin and path; '' for none.
  readonly chat: () => string;
  // Website mode: nothing but that chat room may be framed, not even this origin (O66).
  readonly chatOnly: boolean;
  // The sites that may frame the game (the embed allowlist), read per response.
  readonly embedOrigins: () => readonly string[];
}

export async function registerSecurityHeaders(
  app: FastifyInstance,
  frames: FrameRules,
): Promise<void> {
  const { embedOrigins } = frames;
  const noChat = frames.chatOnly ? "'none'" : "'self'";
  const ancestors = (req: IncomingMessage) =>
    isAdminPath(req.url)
      ? "'none'"
      : ["'self'", ...embedOrigins().filter((o) => PLAIN_ORIGIN.test(o))].join(' ');
  await app.register(helmet, {
    contentSecurityPolicy: {
      // "default-src 'self'" plus explicit directives; the admin paths are framed by nobody
      // ('none', Bingo 03 §7). Fonts only from this origin: helmet's default would add any
      // https: host (ZAP 10055, night run 3 N4).
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'frame-ancestors': [ancestors],
        'form-action': ["'self'"],
        'object-src': ["'none'"],
        'img-src': ["'self'", 'data:'],
        'font-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'script-src': ["'self'"],
        'connect-src': ["'self'"],
        'frame-src': [() => frames.chat() || noChat],
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
    // The admin app is framed by nobody, its own origin included (Bingo 03 §7).
    if (isAdminPath(request.raw.url)) {
      reply.header('x-frame-options', 'DENY');
      // Helmet has set the CSP by now; the admin app adds Trusted Types (Bingo 03 §7).
      const csp = reply.getHeader('content-security-policy');
      if (typeof csp === 'string')
        reply.header('content-security-policy', `${csp};${TRUSTED_TYPES}`);
    } else if (embedOrigins().length > 0) reply.removeHeader('x-frame-options');
    done();
  });
}

// No string reaches a script sink (eval, innerHTML of a script…) without a Trusted Types policy.
const TRUSTED_TYPES = "require-trusted-types-for 'script'";
const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=()';
