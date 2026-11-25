/**
 * @file   apps/server/src/http/plugins/securityHeaders.ts
 * @brief  The kit's security header set with the game's frame rules, on every response.
 *
 * Responsibility: hard-set the headers of 03 §7. The set is the kit's `securityHeaderSet`
 *                 (self scripts and styles, no inline style, frame and referrer rules, nosniff,
 *                 a Permissions-Policy that denies camera, microphone, geolocation and
 *                 payment, T430) with the game's rules: `frame-ancestors` admits the embed
 *                 allowlist (07 §1, Bingo 07 §3.4) and X-Frame-Options is dropped where it
 *                 would contradict it; the admin app is framed by nobody and requires Trusted
 *                 Types for scripts (enforced since the built app was checked in Chromium,
 *                 DECISIONS T178); `frame-src` admits the host chat while the chat provider is
 *                 hostEmbed, else 'self'; in website mode only the website's own
 *                 `/embed/chat` (by path, 07 §2), else 'none'. Helmet adds the headers the
 *                 kit's set does not name. HSTS comes from the TLS proxy.
 * Depends on:     @fastify/helmet, @seasonal/kit/server (securityHeaderSet, securityHeadersHook)
 * Used by:        ../app.ts
 * Spec:           Bingo 03 §7, Bingo 05 §1; Bingo 07 §3.4, §6; docs/spec/07-integration.md §2
 */
import helmet from '@fastify/helmet';
import {
  securityHeaderSet,
  securityHeadersHook,
  type SecurityHeaderSet,
} from '@seasonal/kit/server';
import type { FastifyInstance } from 'fastify';

// The admin app and its API are never framed by another site.
const ADMIN = /\/admin(\/|\?|$)/;
// Only a plain origin reaches the header, so no stored value can add a directive; the kit
// refuses any other, so a bad stored one is left out here rather than failing the response.
const PLAIN_ORIGIN = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/;

interface FrameRules {
  // The host's chat room pages may frame with the provider hostEmbed (07 §2), read per
  // response: an origin, or the website's room as origin and path; '' for none.
  readonly chat: () => string;
  // Website mode: nothing but that chat room may be framed, not even this origin (O66).
  readonly chatOnly: boolean;
  // The sites that may frame the game (the embed allowlist), read per response.
  readonly embedOrigins: () => readonly string[];
}

// The kit's set with the two rules it cannot say, and two directives it does not set.
function headersFor(url: string, frames: FrameRules): SecurityHeaderSet {
  const set = securityHeaderSet({
    // Both modes: the embed allowlist's sites may frame the game (the kit's website mode
    // admits only the website itself).
    mode: 'standalone',
    ancestors: frames.embedOrigins().filter((o) => PLAIN_ORIGIN.test(o)),
    admin: ADMIN.test(url),
  });
  return {
    headers: set.headers,
    directives: {
      ...set.directives,
      // The website's chat room is one path on the public origin; the kit takes origins only.
      'frame-src': [frames.chat() || (frames.chatOnly ? "'none'" : "'self'")],
      'script-src-attr': ["'none'"],
      'upgrade-insecure-requests': [],
    },
  };
}

export async function registerSecurityHeaders(
  app: FastifyInstance,
  frames: FrameRules,
): Promise<void> {
  // Helmet for the other headers only; everything the kit's set names comes from the hook.
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    referrerPolicy: false,
    // HSTS is only meaningful behind TLS: the standalone Caddy sends it (ops/Caddyfile).
    strictTransportSecurity: false,
    xContentTypeOptions: false,
    xFrameOptions: false,
  });
  app.addHook(
    'onRequest',
    securityHeadersHook((url) => headersFor(url, frames)),
  );
}
