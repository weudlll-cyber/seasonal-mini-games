/**
 * @file   apps/server/src/integration/webhookDelivery.ts
 * @module server/integration
 * @brief  Sends the due webhook deliveries, signed, and retries a failed one three times.
 *
 * Responsibility: claim up to 20 due deliveries (a lease, so two runs never send one twice),
 *                 POST each body through the SSRF-safe client with `X-SMG-Signature:
 *                 t=<ts>,v1=<hex>` (HMAC-SHA256 of `${t}.${body}` under the endpoint's secret),
 *                 and record the outcome: a 2xx is delivered; otherwise the attempt is kept with
 *                 its error and retried after 30 s, 2 min and 8 min, then marked failed (Bingo 07 §5).
 * Depends on:     node:crypto, @smg/contracts (types), ./webhooks
 * Used by:        ../http/app, ../main, test/*
 * Spec:           docs/spec/07-integration.md §1, §3.2; Bingo 07 §5
 */
import { createHmac } from 'node:crypto';

import type { WebhookPayload } from '@smg/contracts';

import type { WebhookStore } from './webhooks.js';

const BATCH = 20;
// The first attempt and three retries.
const MAX_ATTEMPTS = 4;
const FIRST_RETRY_MS = 30_000;
const LEASE_MS = 60_000;

type Post = (
  url: string,
  body: string,
  headers: Readonly<Record<string, string>>,
) => Promise<number>;

// The signature header of a body sent at `timestamp` (seconds).
export function signatureHeader(secret: string, timestamp: number, body: string): string {
  const mac = createHmac('sha256', secret)
    .update(`${String(timestamp)}.${body}`)
    .digest('hex');
  return `t=${String(timestamp)},v1=${mac}`;
}

// The wait before the next attempt after `attempts` failed ones: 30 s, 2 min, 8 min.
export const retryDelayMs = (attempts: number): number => FIRST_RETRY_MS * 4 ** (attempts - 1);

interface Due {
  id: string;
  url: string;
  secret_enc: Buffer;
  event: string;
  payload: WebhookPayload;
  attempts: number;
}

export class WebhookDelivery {
  constructor(
    private readonly store: WebhookStore,
    private readonly post: Post,
  ) {}

  // The deliveries due at `now` (a later `now` lets a test reach the retries): the number sent.
  async deliverDue(now: number = Date.now()): Promise<number> {
    const due = await this.claim(now);
    for (const d of due) await this.send(d, now);
    return due.length;
  }

  private async claim(now: number): Promise<Due[]> {
    const r = await this.store.pool.query<Due>(
      `WITH due AS (
         SELECT d.id FROM smg.webhook_deliveries d
         JOIN smg.webhook_endpoints e ON e.id = d.endpoint_id AND e.enabled
         WHERE d.status = 'pending' AND d.next_at <= to_timestamp($1 / 1000.0)
         ORDER BY d.next_at LIMIT $2 FOR UPDATE OF d SKIP LOCKED)
       UPDATE smg.webhook_deliveries w SET next_at = to_timestamp(($1 + $3) / 1000.0)
       FROM due, smg.webhook_endpoints e
       WHERE w.id = due.id AND e.id = w.endpoint_id
       RETURNING w.id::text, e.url, e.secret_enc, w.event, w.payload, w.attempts`,
      [now, BATCH, LEASE_MS],
    );
    return r.rows;
  }

  private async send(d: Due, now: number): Promise<void> {
    const body = JSON.stringify(d.payload);
    const headers = {
      'content-type': 'application/json',
      'user-agent': 'seasonal-mini-games-webhooks',
      'x-smg-event': d.event,
      'x-smg-delivery': d.id,
      'x-smg-signature': signatureHeader(
        this.store.secretOf(d.secret_enc),
        Math.floor(now / 1000),
        body,
      ),
    };
    let error: string | null;
    try {
      const status = await this.post(d.url, body, headers);
      error = status >= 200 && status < 300 ? null : `answered ${String(status)}`;
    } catch (failure) {
      error = failure instanceof Error ? failure.message.slice(0, 200) : 'failed';
    }
    await this.record(d, now, error);
  }

  private async record(d: Due, now: number, error: string | null): Promise<void> {
    const attempts = d.attempts + 1;
    const status = error === null ? 'delivered' : attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
    await this.store.pool.query(
      `UPDATE smg.webhook_deliveries SET attempts = $2, status = $3, last_error = $4,
         next_at = to_timestamp($5 / 1000.0),
         delivered_at = CASE WHEN $3 = 'delivered' THEN now() END
       WHERE id = $1`,
      [d.id, attempts, status, error, now + retryDelayMs(attempts)],
    );
  }
}

// The delivery loop of a running server: every 2 s, one run at a time.
export function startWebhookDelivery(delivery: WebhookDelivery): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    delivery
      .deliverDue()
      .catch((error: unknown) => {
        console.error('[smg] webhook delivery failed:', error);
      })
      .finally(() => {
        running = false;
      });
  }, 2_000);
  return () => {
    clearInterval(timer);
  };
}
