/**
 * @file   apps/server/src/match/rosterRules.ts
 * @module server/match
 * @brief  Who may join a shared round's roster under the optional anti-multi-account rule.
 *
 * Responsibility: with `antiMulti.requireLinkedChat` on, a shared round keeps only players
 *                 whose account the website reported linked to Telegram or Discord: the `links`
 *                 of their last handoff (`external_identities.last_claims`, refreshed at every
 *                 login, 07 §4). Bots and individual rounds are not affected.
 * Depends on:     @smg/application (SettingsService), @smg/game-sdk (RosterPlayer), ../db/pool
 * Used by:        ./play
 * Spec:           docs/spec/05-security-threat-model.md §6; docs/spec/07-integration.md §4
 */
import type { SettingsService } from '@smg/application';
import type { RosterPlayer } from '@smg/game-sdk';

import type { DbPool } from '../db/pool.js';

// The players of the roster the rule admits (all of them while it is off).
export async function admitted(
  pool: DbPool,
  settings: SettingsService,
  roundId: string,
  players: readonly RosterPlayer[],
): Promise<readonly RosterPlayer[]> {
  const rules = await settings.values('security');
  if (rules['antiMulti.requireLinkedChat'] !== true) return players;
  const mode = await pool.query<{ secret_mode: string }>(
    'SELECT secret_mode FROM smg.rounds WHERE id = $1',
    [roundId],
  );
  if (mode.rows[0]?.secret_mode !== 'shared') return players;
  const keys = players.map((p) => p.playerId).filter((k) => !k.startsWith('bot-'));
  const linked = await pool.query<{ account_id: string }>(
    `SELECT DISTINCT account_id::text FROM smg.external_identities
     WHERE account_id::text = ANY($1) AND jsonb_array_length(last_claims->'links') > 0`,
    [keys],
  );
  const ok = new Set(linked.rows.map((r) => r.account_id));
  return players.filter((p) => p.playerId.startsWith('bot-') || ok.has(p.playerId));
}
