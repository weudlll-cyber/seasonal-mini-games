/**
 * @file   apps/server/src/integration/outbound.test.ts
 * @module server/integration
 * @brief  The server's outside calls refuse inward addresses, however written, and plain HTTP.
 *
 * Responsibility: a loopback address written as IPv4-mapped IPv6 in hex (`[::ffff:7f00:1]`) is
 *                 refused like every other inward one; the JSON read takes https only, the
 *                 webhook https even with the development allowance; with the allowance a local
 *                 server is read, a redirect and an answer over 64 KiB still refused, and a
 *                 status that is not 2xx is an error. The kit tests its own address ranges.
 * Depends on:     vitest, node:http, ./outbound
 * Spec:           docs/spec/07-integration.md §3.2, §5; docs/spec/09-testing-strategy.md §6 (feed)
 */
import { createServer } from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fetchJson, postWebhook } from './outbound.js';

const server = createServer((req, res) => {
  if (req.url === '/redirect') {
    res.writeHead(302, { location: '/ok' }).end();
    return;
  }
  res.statusCode = req.url === '/gone' ? 410 : 200;
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

const strict = { allowLocal: false };
const local = { allowLocal: true };

// Inward addresses; the last two are 127.0.0.1 as IPv4-mapped IPv6, in hex and dotted.
const INWARD = [
  'https://127.0.0.1:1/',
  'https://10.1.2.3/x',
  'https://169.254.169.254/latest',
  'https://[::1]/x',
  'https://[::ffff:7f00:1]:1/',
  'https://[::ffff:127.0.0.1]:1/',
  'https://localhost:1/',
];

describe('the outside calls', () => {
  it('refuse every inward address before anything is sent', async () => {
    for (const url of INWARD) {
      await expect(fetchJson(url, strict), url).rejects.toThrow(/not public/);
      await expect(postWebhook(url, '{}', {}, strict), url).rejects.toThrow(/not public/);
    }
  });

  it('refuse plain HTTP: the read without the allowance, a webhook always', async () => {
    await expect(fetchJson(`${base}/ok`, strict)).rejects.toThrow(/https/);
    await expect(postWebhook('http://hooks.example.org/x', '{}', {}, local)).rejects.toThrow(
      /https/,
    );
  });

  it('read a local feed only with the allowance, never a redirect, an error or 64 KiB', async () => {
    expect(await fetchJson(`${base}/ok`, local)).toEqual({ ok: true });
    await expect(fetchJson(`${base}/redirect`, local)).rejects.toThrow(/redirect/);
    await expect(fetchJson(`${base}/gone`, local)).rejects.toThrow(/answered 410/);
    await expect(fetchJson(`${base}/big`, local)).rejects.toThrow(/too large/);
  });
});
