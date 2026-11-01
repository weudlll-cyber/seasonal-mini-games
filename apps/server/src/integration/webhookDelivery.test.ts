/**
 * @file   apps/server/src/integration/webhookDelivery.test.ts
 * @module server/integration
 * @brief  The webhook signature, the retry schedule, and the addresses the client refuses.
 *
 * Responsibility: `X-SMG-Signature: t=<ts>,v1=<hex>` is HMAC-SHA256 of `${t}.${body}` under the
 *                 endpoint's secret, as a receiver recomputes it, and changes with the body, the
 *                 time and the secret; retries wait 30 s, 2 min, 8 min; plain HTTP and private or
 *                 loopback addresses are refused before any connection.
 * Depends on:     vitest, node:crypto, ./webhookDelivery, ./safePost
 * Spec:           docs/spec/07-integration.md §3.2; Bingo 07 §5; Bingo 03 §10
 */
import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { safePost } from './safePost.js';
import { retryDelayMs, signatureHeader } from './webhookDelivery.js';

describe('the webhook signature', () => {
  const body = '{"id":"e-1","event":"round.ended","at":1,"data":{}}';

  it('is the HMAC-SHA256 of "<t>.<body>" a receiver recomputes', () => {
    const header = signatureHeader('s3cret', 1_800_000_000, body);
    const [t, v1] = header.split(',').map((part) => part.split('=')[1]);
    expect(t).toBe('1800000000');
    const expected = createHmac('sha256', 's3cret').update(`1800000000.${body}`).digest('hex');
    expect(v1).toBe(expected);
    expect(header).toBe(`t=1800000000,v1=${expected}`);
  });

  it('changes with the body, the time and the secret', () => {
    const base = signatureHeader('s3cret', 1, body);
    expect(signatureHeader('s3cret', 1, `${body} `)).not.toBe(base);
    expect(signatureHeader('s3cret', 2, body)).not.toBe(base);
    expect(signatureHeader('other', 1, body)).not.toBe(base);
  });
});

describe('the retries', () => {
  it('wait 30 s, 2 min and 8 min', () => {
    expect([1, 2, 3].map(retryDelayMs)).toEqual([30_000, 120_000, 480_000]);
  });
});

describe('the webhook client', () => {
  const strict = { allowLocal: false };

  it('refuses plain HTTP and addresses that are not public', async () => {
    for (const url of [
      'http://hooks.example.org/x',
      'https://127.0.0.1/x',
      'https://10.1.2.3/x',
      'https://169.254.169.254/latest',
      'https://[::1]/x',
    ]) {
      await expect(safePost(url, '{}', {}, strict), url).rejects.toThrow();
    }
  });
});
