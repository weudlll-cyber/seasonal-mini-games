/**
 * @file   apps/server/src/integration/webhooks.ts
 * @module server/integration
 * @brief  Webhook endpoints and their deliveries in PostgreSQL: the admin's list, events queued.
 *
 * Responsibility: an endpoint is created with a secret the server draws and shows once; the
 *                 secret is kept sealed (AES-256-GCM under a key derived for webhooks, never the
 *                 round key itself); endpoints are listed with their last delivery, changed and
 *                 removed; an event becomes one pending delivery per enabled endpoint that wants
 *                 it, under one event id (07 §3.2); an endpoint's recent deliveries for the admin.
 * Depends on:     node:crypto, @smg/contracts, ../db/pool, ../round/seal
 * Used by:        ./webhookDelivery, ./webhookEvents, ../http/routes/adminWebhooks
 * Spec:           docs/spec/07-integration.md §1, §3.2; Bingo 07 §5; Bingo 04 §3.6
 */
import { randomBytes, randomUUID } from 'node:crypto';

import type {
  WebhookDeliveryView,
  WebhookEndpointBody,
  WebhookEndpointCreated,
  WebhookEndpointView,
  WebhookEvent,
  WebhookPayload,
} from '@smg/contracts';
import type { z } from 'zod';

import type { DbPool } from '../db/pool.js';
import { openSeed, sealSeed } from '../round/seal.js';

type Body = z.infer<typeof WebhookEndpointBody>;

interface EndpointRow {
  id: string;
  url: string;
  events: WebhookEvent[];
  enabled: boolean;
  created_at: Date;
  last_status: 'pending' | 'delivered' | 'failed' | null;
  last_at: Date | null;
  last_error: string | null;
}

const ENDPOINT = `SELECT e.id::text, e.url, e.events, e.enabled, e.created_at,
    d.status AS last_status, d.created_at AS last_at, d.last_error
  FROM smg.webhook_endpoints e
  LEFT JOIN LATERAL (SELECT status, created_at, last_error FROM smg.webhook_deliveries
    WHERE endpoint_id = e.id ORDER BY created_at DESC LIMIT 1) d ON true`;

const endpointView = (r: EndpointRow): WebhookEndpointView => ({
  id: r.id,
  url: r.url,
  events: r.events,
  enabled: r.enabled,
  createdAt: r.created_at.toISOString(),
  lastDelivery:
    r.last_status === null || r.last_at === null
      ? null
      : { status: r.last_status, at: r.last_at.toISOString(), error: r.last_error },
});

export class WebhookStore {
  constructor(
    readonly pool: DbPool,
    // Derived for webhook secrets (../config/roundKey derivedKey).
    private readonly key: Buffer,
  ) {}

  async list(): Promise<WebhookEndpointView[]> {
    const r = await this.pool.query<EndpointRow>(`${ENDPOINT} ORDER BY e.created_at`);
    return r.rows.map(endpointView);
  }

  private async one(id: string): Promise<WebhookEndpointView | null> {
    const r = await this.pool.query<EndpointRow>(`${ENDPOINT} WHERE e.id = $1`, [id]);
    return r.rows[0] === undefined ? null : endpointView(r.rows[0]);
  }

  async create(body: Body, by: string): Promise<WebhookEndpointCreated> {
    const secret = randomBytes(32).toString('base64url');
    const r = await this.pool.query<{ id: string }>(
      `INSERT INTO smg.webhook_endpoints (url, secret_enc, events, enabled, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
      [body.url, sealSeed(Buffer.from(secret), this.key), body.events, body.enabled, by],
    );
    const made = await this.one(r.rows[0]?.id ?? '');
    if (made === null) throw new Error('webhook endpoint not stored');
    // The only time the secret leaves the server (Bingo 07 §5).
    return { ...made, secret };
  }

  async update(id: string, body: Body): Promise<WebhookEndpointView | null> {
    const r = await this.pool.query(
      'UPDATE smg.webhook_endpoints SET url = $2, events = $3, enabled = $4 WHERE id = $1',
      [id, body.url, body.events, body.enabled],
    );
    return (r.rowCount ?? 0) === 0 ? null : this.one(id);
  }

  async remove(id: string): Promise<boolean> {
    const r = await this.pool.query('DELETE FROM smg.webhook_endpoints WHERE id = $1', [id]);
    return (r.rowCount ?? 0) > 0;
  }

  async deliveries(endpointId: string): Promise<WebhookDeliveryView[]> {
    const r = await this.pool.query<{
      id: string;
      event: WebhookEvent;
      status: 'pending' | 'delivered' | 'failed';
      attempts: number;
      last_error: string | null;
      created_at: Date;
      delivered_at: Date | null;
    }>(
      `SELECT id::text, event, status, attempts, last_error, created_at, delivered_at
       FROM smg.webhook_deliveries WHERE endpoint_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [endpointId],
    );
    return r.rows.map((d) => ({
      id: d.id,
      event: d.event,
      status: d.status,
      attempts: d.attempts,
      lastError: d.last_error,
      createdAt: d.created_at.toISOString(),
      deliveredAt: d.delivered_at?.toISOString() ?? null,
    }));
  }

  // One pending delivery per enabled endpoint that wants the event; the number queued.
  async enqueue(event: WebhookEvent, data: Readonly<Record<string, unknown>>): Promise<number> {
    const payload: WebhookPayload = { id: randomUUID(), event, at: Date.now(), data };
    const r = await this.pool.query(
      `INSERT INTO smg.webhook_deliveries (endpoint_id, event, payload)
       SELECT id, $1, $2 FROM smg.webhook_endpoints WHERE enabled AND $1 = ANY(events)`,
      [event, JSON.stringify(payload)],
    );
    return r.rowCount ?? 0;
  }

  secretOf(sealed: Buffer): string {
    return Buffer.from(openSeed(sealed, this.key)).toString('utf8');
  }
}
