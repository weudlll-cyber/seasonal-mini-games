/**
 * @file   apps/server/src/http/plugins/securityHeaders.test.ts
 * @module server/http
 * @brief  The game's rules on the kit's headers: chat frame, ancestors, admin, no inline style.
 *
 * Responsibility: in website mode `frame-src` is the website's `/embed/chat` by its path on
 *                 the public origin while the chat is hostEmbed, and 'none' without a host
 *                 chat (not even this origin); standalone keeps the host chat's origin, else
 *                 'self' (DECISIONS T91, T236). No policy allows an inline style; the embed
 *                 allowlist may frame the game, nobody the admin app, which requires Trusted
 *                 Types.
 * Depends on:     vitest, fastify, ./securityHeaders
 * Spec:           docs/spec/07-integration.md §2
 */
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { registerSecurityHeaders } from './securityHeaders.js';

async function frameSrc(chat: string, chatOnly: boolean): Promise<string | undefined> {
  const f = Fastify();
  await registerSecurityHeaders(f, { chat: () => chat, chatOnly, embedOrigins: () => [] });
  f.get('/', () => ({ ok: true }));
  const csp = String((await f.inject({ url: '/' })).headers['content-security-policy']);
  await f.close();
  return csp.split('; ').find((d) => d.startsWith('frame-src'));
}

describe('frame-src', () => {
  it("admits only the website's own /embed/chat in website mode", async () => {
    expect(await frameSrc('https://example.org/embed/chat', true)).toBe(
      'frame-src https://example.org/embed/chat',
    );
    expect(await frameSrc('', true)).toBe("frame-src 'none'");
  });

  it('stays as it was standalone', async () => {
    expect(await frameSrc('https://chat.example', false)).toBe('frame-src https://chat.example');
    expect(await frameSrc('', false)).toBe("frame-src 'self'");
  });
});

async function headersOf(url: string, origins: readonly string[]) {
  const f = Fastify();
  await registerSecurityHeaders(f, {
    chat: () => '',
    chatOnly: false,
    embedOrigins: () => origins,
  });
  f.get('/', () => ({ ok: true }));
  f.get('/admin/', () => ({ ok: true }));
  const { headers } = await f.inject({ url });
  await f.close();
  return headers;
}

describe('the other headers', () => {
  it('allow no inline style or script', async () => {
    const csp = String((await headersOf('/', []))['content-security-policy']);
    expect(csp).toContain("style-src 'self';");
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toContain('unsafe-inline');
  });

  it('let the allowlisted sites frame the game, a stored value that is no origin left out', async () => {
    const own = await headersOf('/', []);
    expect(own['x-frame-options']).toBe('SAMEORIGIN');
    const listed = await headersOf('/', ['https://host.example', 'https://x; script-src *']);
    expect(String(listed['content-security-policy'])).toContain(
      "frame-ancestors 'self' https://host.example;",
    );
    expect(listed['x-frame-options']).toBeUndefined();
  });

  it('frame the admin app nowhere and require Trusted Types there', async () => {
    const admin = await headersOf('/admin/', ['https://host.example']);
    const csp = String(admin['content-security-policy']);
    expect(csp).toContain("frame-ancestors 'none';");
    expect(csp).toContain("require-trusted-types-for 'script'");
    expect(admin['x-frame-options']).toBe('DENY');
    expect(admin['x-dns-prefetch-control']).toBe('off');
  });
});
