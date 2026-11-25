/**
 * @file   apps/server/src/integration/webhookDelivery.test.ts
 * @module server/integration
 * @brief  The webhook signature and the retry schedule.
 *
 * Responsibility: `X-SMG-Signature: t=<ts>,v1=<hex>` is HMAC-SHA256 of `${t}.${body}` under the
 *                 endpoint's secret, as a receiver recomputes it, and changes with the body, the
 *                 time and the secret; retries wait 30 s, 2 min, 8 min. The addresses the client
 *                 refuses are ./outbound.test.
 * Depends on:     vitest, node:crypto, ./webhookDelivery
 * Spec:           docs/spec/07-integration.md §3.2; Bingo 07 §5; Bingo 03 §10
 */
import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

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
