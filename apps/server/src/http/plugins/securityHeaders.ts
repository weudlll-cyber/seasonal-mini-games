/**
 * @file   apps/server/src/http/plugins/securityHeaders.ts
 * @brief  The kit's security header set with the game's frame rules, on every response.
 *
 * Responsibility: hard-set the headers of 03 §7 with the kit's `securityHeaderSet` (self
 *                 scripts and styles, no inline style or event handler, referrer rules,
 *                 nosniff, a Permissions-Policy that denies camera, microphone, geolocation
 *                 and payment; over https, `upgrade-insecure-requests`). Standalone, the embed
 *                 allowlist may frame the game (07 §1, Bingo 07 §3.4) and X-Frame-Options is
 *                 dropped where it would contradict that; in website mode the website alone
 *                 frames it (kit K81, O157). The admin app is framed by nobody and requires
 *                 Trusted Types for scripts (DECISIONS T178). `frame-src` admits the host chat
 *                 while the chat provider is hostEmbed: its origin standalone, the website's
 *                 `/embed/chat` by its path in website mode (07 §2), where it also admits the
 *                 website's shared call view `/embed/call/shared` (kit K77); without either
 *                 'self' standalone and 'none' in website mode. Helmet adds the headers the
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

interface HeaderRules {
  readonly mode: 'website' | 'standalone';
  // Served over https (as the session cookie is told): browsers upgrade http addresses.
  readonly secure: boolean;
  // The host's chat room pages may frame with the provider hostEmbed (07 §2), read per
  // response: an origin, or the website's room as origin and path; '' for none.
  readonly chat: () => string;
  // Website mode: the website's shared call view, as origin and path; '' standalone.
  readonly sharedCall: string;
  // Standalone: the sites that may frame the game (the embed allowlist), read per response.
  readonly embedOrigins: () => readonly string[];
}

// What a page may frame: the host chat and the website's shared call, as the kit takes them
// (an origin, an https address with its path, a plain-http path on a development host).
function framesOf(rules: HeaderRules): readonly string[] {
  const frames = [rules.chat(), rules.sharedCall].filter((source) => source !== '');
  if (frames.length > 0) return frames;
  return rules.mode === 'website' ? [] : ["'self'"];
}

function headersFor(url: string, rules: HeaderRules): SecurityHeaderSet {
  const website = rules.mode === 'website';
  return securityHeaderSet({
    mode: rules.mode,
    ...(website ? {} : { ancestors: rules.embedOrigins().filter((o) => PLAIN_ORIGIN.test(o)) }),
    admin: ADMIN.test(url),
    secure: rules.secure,
    frames: framesOf(rules),
  });
}

export async function registerSecurityHeaders(
  app: FastifyInstance,
  rules: HeaderRules,
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
    securityHeadersHook((url) => headersFor(url, rules)),
  );
}
