/**
 * @file   apps/server/src/seasons/safeFetch.test.ts
 * @module server/seasons
 * @brief  The feed fetch refuses inward addresses, plain HTTP, redirects and large answers.
 *
 * Responsibility: private, loopback, link-local, carrier-grade NAT and unique-local addresses
 *                 (IPv4-mapped too) are not public; a non-https address and an https address
 *                 that resolves inward are refused; with the development allowance a local
 *                 server is read, but a redirect and an answer over 64 KiB are still refused.
 * Depends on:     vitest, node:http, ./safeFetch
 * Spec:           docs/spec/07-integration.md §5; docs/spec/09-testing-strategy.md §6 (feed)
 */
import { createServer } from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { isPublicAddress, safeFetchJson } from './safeFetch.js';

const server = createServer((req, res) => {
  if (req.url === '/redirect') {
    res.writeHead(302, { location: '/ok' }).end();
    return;
  }
  res.setHeader('content-type', 'application/json');
  res.end(req.url === '/big' ? JSON.stringify({ x: 'y'.repeat(70 * 1024) }) : '{"ok":true}');
});
let base = '';

beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const a = server.address();
  base = `http://127.0.0.1:${String(typeof a === 'object' && a !== null ? a.port : 0)}`;
});

afterAll(async () => {
  await new Promise<void>((r) => {
    server.close(() => {
      r();
    });
  });
});

describe('addresses', () => {
  it('tell public from inward ones', () => {
    for (const a of [
      '10.1.2.3',
      '127.0.0.1',
      '169.254.1.1',
      '172.20.0.1',
      '192.168.0.1',
      '100.64.0.1',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:10.0.0.1',
      'nonsense',
    ]) {
      expect(isPublicAddress(a), a).toBe(false);
    }
    for (const a of ['8.8.8.8', '1.1.1.1', '2606:4700::1111', '::ffff:8.8.8.8'])
      expect(isPublicAddress(a), a).toBe(true);
  });
});

describe('the feed fetch', () => {
  const strict = { allowLocal: false };
  const local = { allowLocal: true };

  it('refuses plain HTTP and an https address that points inward', async () => {
    await expect(safeFetchJson(`${base}/ok`, strict)).rejects.toThrow(/https/);
    await expect(safeFetchJson('https://127.0.0.1:1/', strict)).rejects.toThrow(/not public/);
    await expect(safeFetchJson('https://localhost:1/', strict)).rejects.toThrow(/not public/);
  });

  it('reads a local feed only with the development allowance, never a redirect or 64 KiB', async () => {
    expect(await safeFetchJson(`${base}/ok`, local)).toEqual({ ok: true });
    await expect(safeFetchJson(`${base}/redirect`, local)).rejects.toThrow();
    await expect(safeFetchJson(`${base}/big`, local)).rejects.toThrow(/64 KiB/);
  });
});
