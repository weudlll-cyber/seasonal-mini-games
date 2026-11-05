/**
 * @file   apps/server/src/http/plugins/securityHeaders.test.ts
 * @module server/http
 * @brief  The CSP's `frame-src`: the website's own chat room only in website mode, standalone unchanged.
 *
 * Responsibility: in website mode `frame-src` is the website's `/embed/chat` by its path on
 *                 the public origin while the chat is hostEmbed, and 'none' without a host
 *                 chat (not even this origin); standalone keeps the host chat's origin, else
 *                 'self' (DECISIONS T91, T236).
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
  return csp.split(';').find((d) => d.startsWith('frame-src'));
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
