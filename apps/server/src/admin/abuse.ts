/**
 * @file   apps/server/src/admin/abuse.ts
 * @module server/admin
 * @brief  Abuse signals: record one, and the moderators' list of accounts by 7-day score.
 *
 * Responsibility: each signal (cooldown refusals, bot-like timing, rate-limit hits, failed
 *                 logins, …) is one row with a weight; an account's score is the sum of the
 *                 last 7 days. Signals only inform moderators; nothing here sanctions an
 *                 account (DECISIONS S5).
 * Depends on:     @smg/contracts (AbuseRowView), ../db/pool
 * Used by:        ./accountsAdmin, ../http/routes/adminAccounts, ../http/routes/auth
 * Spec:           docs/spec/05-security-threat-model.md §2, §7; Bingo 03 §13
 */
import type { AbuseRowView } from '@smg/contracts';

import type { DbPool } from '../db/pool.js';

export const SCORE_WINDOW = '7 days';

export interface AbuseSignal {
  readonly accountId: string;
  readonly kind: string;
  readonly detail: string;
  readonly weight: number;
}

export async function recordSignal(pool: DbPool, signal: AbuseSignal): Promise<void> {
  await pool.query(
    'INSERT INTO smg.abuse_signals (account_id, kind, detail, weight) VALUES ($1, $2, $3, $4)',
    [signal.accountId, signal.kind, signal.detail.slice(0, 200), signal.weight],
  );
}

interface AbuseRow {
  account_id: string;
  display_name: string;
  score: number;
  recent: { kind: string; at: string; detail: string }[];
}

// The 50 accounts with the highest score, each with its last five signals.
export async function abuseRows(pool: DbPool): Promise<AbuseRowView[]> {
  const r = await pool.query<AbuseRow>(
    `SELECT s.account_id, a.display_name, sum(s.weight)::int AS score,
       (SELECT json_agg(x ORDER BY x.at DESC) FROM (
          SELECT kind, to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS at, detail
          FROM smg.abuse_signals WHERE account_id = s.account_id ORDER BY id DESC LIMIT 5) x) AS recent
     FROM smg.abuse_signals s JOIN smg.accounts a ON a.id = s.account_id
     WHERE s.at > now() - $1::interval
     GROUP BY s.account_id, a.display_name
     ORDER BY score DESC LIMIT 50`,
    [SCORE_WINDOW],
  );
  return r.rows.map((row) => {
    const last = row.recent[0];
    return {
      accountId: row.account_id,
      displayName: row.display_name,
      score: row.score,
      lastKind: last?.kind ?? '',
      lastAt: last?.at ?? '',
      recent: row.recent,
    };
  });
}
