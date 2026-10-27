/**
 * @file   apps/server/src/integration/embedOrigins.ts
 * @module server/integration
 * @brief  The embed allowlist: the sites an admin approved, kept in memory for every check.
 *
 * Responsibility: smg.embed_origins listed, saved (a second save of an origin changes its label
 *                 and handoff flag) and removed; the list in memory for the checks it drives
 *                 (CSP frame-ancestors, the client's postMessage check, the socket Origin, CORS;
 *                 Bingo 07 §3.4), read again at once after a change and otherwise at most every
 *                 5 s in the background, so a request never waits for the database (as T73).
 * Depends on:     @smg/contracts (views, body), ../db/pool
 * Used by:        ../http/app, ../http/plugins/securityHeaders, ../http/routes/*, ../realtime/gateway
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §3.4; Bingo 04 §3.2
 */
import type { EmbedConfigView, EmbedOriginBody, EmbedOriginView } from '@smg/contracts';
import type { z } from 'zod';

import type { DbPool } from '../db/pool.js';

const REFRESH_MS = 5_000;

interface Row {
  origin: string;
  label: string;
  allow_auth_handoff: boolean;
  created_at: Date;
}

const view = (r: Row): EmbedOriginView => ({
  origin: r.origin,
  label: r.label,
  allowAuthHandoff: r.allow_auth_handoff,
  createdAt: r.created_at.toISOString(),
});

export class EmbedAllowlist {
  private origins: readonly EmbedOriginView[] = [];
  private readAt = -Infinity;
  private reading = false;

  constructor(private readonly pool: DbPool) {}

  async list(): Promise<EmbedOriginView[]> {
    const r = await this.pool.query<Row>(
      'SELECT origin, label, allow_auth_handoff, created_at FROM smg.embed_origins ORDER BY origin',
    );
    const all = r.rows.map(view);
    this.origins = all;
    this.readAt = Date.now();
    return all;
  }

  async save(body: z.infer<typeof EmbedOriginBody>, by: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO smg.embed_origins (origin, label, allow_auth_handoff, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (origin) DO UPDATE SET label = $2, allow_auth_handoff = $3`,
      [body.origin, body.label, body.allowAuthHandoff, by],
    );
    await this.list();
  }

  async remove(origin: string): Promise<boolean> {
    const r = await this.pool.query('DELETE FROM smg.embed_origins WHERE origin = $1', [origin]);
    await this.list();
    return (r.rowCount ?? 0) > 0;
  }

  // The origins now, refreshed in the background when the copy is older than 5 s.
  private current(): readonly EmbedOriginView[] {
    if (!this.reading && Date.now() - this.readAt > REFRESH_MS) {
      this.reading = true;
      this.list()
        .catch((error: unknown) => {
          console.error('[smg] embed allowlist refresh failed:', error);
        })
        .finally(() => {
          this.reading = false;
        });
    }
    return this.origins;
  }

  config(): EmbedConfigView {
    const all = this.current();
    return {
      origins: all.map((o) => o.origin),
      handoffOrigins: all.filter((o) => o.allowAuthHandoff).map((o) => o.origin),
    };
  }

  allows(origin: string): boolean {
    return this.current().some((o) => o.origin === origin);
  }

  allowsHandoff(origin: string): boolean {
    return this.current().some((o) => o.origin === origin && o.allowAuthHandoff);
  }
}
