/**
 * @file   apps/server/src/chat/sanctions.ts
 * @module server/chat
 * @brief  Chat mutes and bans: in force for an account and room (cached), made, lifted, listed.
 *
 * Responsibility: a sanction is in force while it is not lifted and, for a mute, not expired;
 *                 its scope is everywhere (`global`) or one room. The send pipeline asks for
 *                 an account's sanctions in force; the answer is cached for 10 s and dropped
 *                 at once when a moderator makes or lifts one on this server, so a muted
 *                 player's next message is refused. A ban outweighs a mute. Every sanction has
 *                 reason, actor and expiry (Bingo 03 §12); the routes audit them.
 * Depends on:     @smg/contracts (ChatSanctionView), ../db/pool
 * Used by:        ./chat, ./moderation
 * Spec:           Bingo 03 §12, Bingo 04 §3.5, Bingo 06 §7
 */
import type { ChatSanctionView } from '@smg/contracts';

import type { DbPool } from '../db/pool.js';

const CACHE_MS = 10_000;

interface InForce {
  readonly kind: 'mute' | 'ban';
  readonly scope: string;
  readonly expiresAt: number | null;
}

export type Sanctioned =
  { readonly code: 'CHAT_BANNED' } | { readonly code: 'CHAT_MUTED'; readonly until: number };

export interface NewSanction {
  readonly accountId: string;
  readonly kind: 'mute' | 'ban';
  readonly scope: string;
  readonly minutes: number | null;
  readonly reason: string;
  readonly by: string;
}

export class Sanctions {
  private readonly cache = new Map<string, { at: number; rows: readonly InForce[] }>();

  constructor(
    private readonly pool: DbPool,
    private readonly now: () => number = Date.now,
  ) {}

  // The sanction that keeps this account from writing in this room, or null.
  async against(accountId: string, roomId: string): Promise<Sanctioned | null> {
    const t = this.now();
    const rows = (await this.inForce(accountId, t)).filter(
      (s) => (s.scope === 'global' || s.scope === roomId) && (s.expiresAt ?? Infinity) > t,
    );
    if (rows.some((s) => s.kind === 'ban')) return { code: 'CHAT_BANNED' };
    const until = Math.max(...rows.map((s) => s.expiresAt ?? 0));
    return rows.length === 0 ? null : { code: 'CHAT_MUTED', until };
  }

  async create(s: NewSanction): Promise<string> {
    const r = await this.pool.query<{ id: string }>(
      `INSERT INTO smg.chat_sanctions (account_id, kind, scope, reason, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5,
         CASE WHEN $6::int IS NULL THEN NULL ELSE now() + make_interval(mins => $6::int) END)
       RETURNING id::text`,
      [s.accountId, s.kind, s.scope, s.reason, s.by, s.minutes],
    );
    this.cache.delete(s.accountId);
    return r.rows[0]?.id ?? '';
  }

  // Lifts one that is not lifted yet; the sanctioned account, or null.
  async lift(id: string, by: string): Promise<string | null> {
    const r = await this.pool.query<{ account_id: string }>(
      `UPDATE smg.chat_sanctions SET lifted_at = now(), lifted_by = $2
       WHERE id = $1 AND lifted_at IS NULL RETURNING account_id::text`,
      [id, by],
    );
    const account = r.rows[0]?.account_id ?? null;
    if (account !== null) this.cache.delete(account);
    return account;
  }

  // The newest 200, lifted and expired ones included (the admin screen filters).
  async list(id?: string): Promise<ChatSanctionView[]> {
    const r = await this.pool.query<{
      id: string;
      display_name: string;
      kind: 'mute' | 'ban';
      scope: string;
      reason: string;
      by_name: string | null;
      created_at: Date;
      expires_at: Date | null;
      lifted_at: Date | null;
    }>(
      `SELECT s.id::text, a.display_name, s.kind, s.scope, s.reason, b.display_name AS by_name,
         s.created_at, s.expires_at, s.lifted_at
       FROM smg.chat_sanctions s JOIN smg.accounts a ON a.id = s.account_id
       LEFT JOIN smg.accounts b ON b.id = s.created_by
       WHERE ($1::uuid IS NULL OR s.id = $1) ORDER BY s.created_at DESC LIMIT 200`,
      [id ?? null],
    );
    return r.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      kind: row.kind,
      scope: row.scope,
      reason: row.reason,
      by: row.by_name,
      at: row.created_at.getTime(),
      expiresAt: row.expires_at?.getTime() ?? null,
      liftedAt: row.lifted_at?.getTime() ?? null,
    }));
  }

  private async inForce(accountId: string, t: number): Promise<readonly InForce[]> {
    const hit = this.cache.get(accountId);
    if (hit !== undefined && t - hit.at < CACHE_MS) return hit.rows;
    const r = await this.pool.query<{
      kind: 'mute' | 'ban';
      scope: string;
      expires_at: Date | null;
    }>(
      `SELECT kind, scope, expires_at FROM smg.chat_sanctions
       WHERE account_id = $1 AND lifted_at IS NULL AND (expires_at IS NULL OR expires_at > now())`,
      [accountId],
    );
    const rows = r.rows.map((s) => ({
      kind: s.kind,
      scope: s.scope,
      expiresAt: s.expires_at?.getTime() ?? null,
    }));
    this.cache.set(accountId, { at: t, rows });
    return rows;
  }
}
