/**
 * @file   apps/server/src/http/plugins/securityHeaders.test.ts
 * @module server/http
 * @brief  The game's rules on the kit's headers: chat frame, who may frame it, admin, no inline.
 *
 * Responsibility: in website mode `frame-src` is the website's `/embed/chat` by its path while
 *                 the chat is hostEmbed (a plain-http development website's too) and the
 *                 shared call view by its path, the latter alone without a host chat, and the
 *                 website alone frames the game, whatever the embed allowlist holds; standalone keeps the host chat's origin, else 'self'
 *                 (DECISIONS T91, T236), and the allowlist's sites may frame it. No policy
 *                 allows an inline style; only a served-over-https install upgrades http
 *                 addresses; nobody frames the admin app, which requires Trusted Types.
 * Depends on:     vitest, fastify, ./securityHeaders
 * Spec:           docs/spec/07-integration.md §2
 */
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { registerSecurityHeaders } from './securityHeaders.js';

type Rules = Parameters<typeof registerSecurityHeaders>[1];

async function headersOf(url: string, change: Partial<Rules> = {}) {
  const f = Fastify();
  await registerSecurityHeaders(f, {
    mode: 'standalone',
    secure: true,
    chat: () => '',
    sharedCall: '',
    embedOrigins: () => [],
    ...change,
  });
  f.get('/', () => ({ ok: true }));
  f.get('/admin/', () => ({ ok: true }));
  const { headers } = await f.inject({ url });
  await f.close();
  return headers;
}

const policyOf = async (change: Partial<Rules> = {}, url = '/') =>
  String((await headersOf(url, change))['content-security-policy']);

const frameSrc = async (mode: Rules['mode'], chat: string, sharedCall = '') =>
  (await policyOf({ mode, chat: () => chat, sharedCall }))
    .split('; ')
    .find((d) => d.startsWith('frame-src'));

describe('frame-src', () => {
  it("admits only the website's own /embed/chat in website mode", async () => {
    expect(await frameSrc('website', 'https://example.org/embed/chat')).toBe(
      'frame-src https://example.org/embed/chat',
    );
    expect(await frameSrc('website', 'http://127.0.0.1:5430/embed/chat')).toBe(
      'frame-src http://127.0.0.1:5430/embed/chat',
    );
    expect(await frameSrc('website', '')).toBe("frame-src 'none'");
  });

  it("admits the website's shared call view beside its chat, and alone without one", async () => {
    const call = 'https://example.org/embed/call/shared';
    expect(await frameSrc('website', 'https://example.org/embed/chat', call)).toBe(
      `frame-src https://example.org/embed/chat ${call}`,
    );
    expect(await frameSrc('website', '', call)).toBe(`frame-src ${call}`);
  });

  it('stays as it was standalone', async () => {
    expect(await frameSrc('standalone', 'https://chat.example')).toBe(
      'frame-src https://chat.example',
    );
    expect(await frameSrc('standalone', '')).toBe("frame-src 'self'");
  });
});

describe('the other headers', () => {
  it('allow no inline style, script or event handler', async () => {
    const csp = await policyOf();
    expect(csp).toContain("style-src 'self';");
    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).not.toContain('unsafe-inline');
  });

  it('upgrade http addresses only where served over https', async () => {
    expect(await policyOf()).toContain('upgrade-insecure-requests');
    expect(await policyOf({ secure: false })).not.toContain('upgrade-insecure-requests');
  });

  it('let the allowlisted sites frame a standalone game, a stored value that is no origin left out', async () => {
    const own = await headersOf('/');
    expect(own['x-frame-options']).toBe('SAMEORIGIN');
    const listed = await headersOf('/', {
      embedOrigins: () => ['https://host.example', 'https://x; script-src *'],
    });
    expect(String(listed['content-security-policy'])).toContain(
      "frame-ancestors 'self' https://host.example;",
    );
    expect(listed['x-frame-options']).toBeUndefined();
  });

  it('let the website alone frame the game in website mode', async () => {
    const headers = await headersOf('/', {
      mode: 'website',
      embedOrigins: () => ['https://host.example'],
    });
    expect(String(headers['content-security-policy'])).toContain("frame-ancestors 'self';");
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('frame the admin app nowhere and require Trusted Types there', async () => {
    const admin = await headersOf('/admin/', { embedOrigins: () => ['https://host.example'] });
    const csp = String(admin['content-security-policy']);
    expect(csp).toContain("frame-ancestors 'none';");
    expect(csp).toContain("require-trusted-types-for 'script'");
    expect(admin['x-frame-options']).toBe('DENY');
    expect(admin['x-dns-prefetch-control']).toBe('off');
  });
});
