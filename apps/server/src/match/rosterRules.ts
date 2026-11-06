/**
 * @file   apps/server/src/match/rosterRules.ts
 * @module server/match
 * @brief  Who may join a shared round's roster under the optional anti-multi-account rules.
 *
 * Responsibility: the two rules of 05 §6 (owner decision 10, both off by default), for
 *                 shared rounds only; bots and individual rounds are not affected.
 *                 `antiMulti.minAccountAgeH` keeps only accounts at least that many hours
 *                 old. `antiMulti.requireLinkedChat` keeps only players whose account the
 *                 website reported linked to Telegram or Discord: the `links` of their last
 *                 handoff (`external_identities.last_claims`, refreshed at every login, 07 §4).
 *                 That fact exists only in a website install, one with a JWT handoff provider
 *                 (DECISIONS T103): a standalone install cannot switch the rule on (the admin
 *                 form says why, the server refuses the setting), and a rule left on after the
 *                 last provider went is not applied, so no roster is emptied by it. In website
 *                 mode (O66) the rule has no effect at all, a JWT provider or not: the proxy
 *                 headers carry no links, and the admin app does not show it (DECISIONS T222).
 *                 `rosterAdmission` binds the rules to the install for the match use cases.
 * Depends on:     @smg/application (SettingsService), @smg/game-sdk (RosterPlayer), ../db/pool
 * Used by:        ./play, ../round/runtime, ../http/routes/adminSettings
 * Spec:           docs/spec/05-security-threat-model.md §6; docs/spec/07-integration.md §4
 */
import type { SettingsService } from '@smg/application';
import type { RosterPlayer } from '@smg/game-sdk';

import type { DbPool } from '../db/pool.js';

export const LINKED_CHAT = 'antiMulti.requireLinkedChat';
export const LINKED_CHAT_UNAVAILABLE =
  'Standalone install: no website hands players over, so no account can show a linked Telegram or Discord.';

// A website install: an enabled JWT handoff provider brings the players' linked accounts.
export async function linkedChatAvailable(pool: DbPool): Promise<boolean> {
  const r = await pool.query(
    "SELECT 1 FROM smg.identity_providers WHERE kind = 'jwt_handoff' AND enabled LIMIT 1",
  );
  return r.rowCount === 1;
}

const accounts = (players: readonly RosterPlayer[]) =>
  players.map((p) => p.playerId).filter((k) => !k.startsWith('bot-'));

// Accounts at least `hours` old.
async function aged(pool: DbPool, keys: readonly string[], hours: number): Promise<Set<string>> {
  const r = await pool.query<{ id: string }>(
    `SELECT id::text FROM smg.accounts
     WHERE id::text = ANY($1) AND created_at <= now() - make_interval(hours => $2)`,
    [keys, hours],
  );
  return new Set(r.rows.map((row) => row.id));
}

// Accounts whose last handoff named a linked Telegram or Discord.
async function linked(pool: DbPool, keys: readonly string[]): Promise<Set<string>> {
  const r = await pool.query<{ account_id: string }>(
    `SELECT DISTINCT account_id::text FROM smg.external_identities
     WHERE account_id::text = ANY($1) AND jsonb_array_length(last_claims->'links') > 0`,
    [keys],
  );
  return new Set(r.rows.map((row) => row.account_id));
}

// The players of the roster the rules admit (all of them while both are off). `website`:
// website mode, where the linked-chat rule is ignored (T222).
async function admitted(
  pool: DbPool,
  settings: SettingsService,
  round: { readonly id: string; readonly website: boolean },
  players: readonly RosterPlayer[],
): Promise<readonly RosterPlayer[]> {
  const rules = await settings.values('security');
  const minAge = rules['antiMulti.minAccountAgeH'] as number;
  const needLink =
    !round.website && rules[LINKED_CHAT] === true && (await linkedChatAvailable(pool));
  if (minAge <= 0 && !needLink) return players;
  const mode = await pool.query<{ secret_mode: string }>(
    'SELECT secret_mode FROM smg.rounds WHERE id = $1',
    [round.id],
  );
  if (mode.rows[0]?.secret_mode !== 'shared') return players;
  const keys = accounts(players);
  const old = minAge > 0 ? await aged(pool, keys, minAge) : null;
  const tied = needLink ? await linked(pool, keys) : null;
  return players.filter(
    (p) =>
      p.playerId.startsWith('bot-') ||
      ((old === null || old.has(p.playerId)) && (tied === null || tied.has(p.playerId))),
  );
}

// The roster of a shared round as this install admits it (./play).
export type Admission = (
  roundId: string,
  players: readonly RosterPlayer[],
) => Promise<readonly RosterPlayer[]>;

export function rosterAdmission(
  pool: DbPool,
  settings: SettingsService,
  website: boolean,
): Admission {
  return (id, players) => admitted(pool, settings, { id, website }, players);
}
