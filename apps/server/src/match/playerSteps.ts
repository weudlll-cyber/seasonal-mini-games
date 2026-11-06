/**
 * @file   apps/server/src/match/playerSteps.ts
 * @module server/match
 * @brief  The Discord steps of website members, for the views that show their names (O66).
 *
 * Responsibility: the steps the website sent at a member's last sign-in (checked then, at most
 *                 three, smg.accounts.steps) by player key, for the keys that have any; and the
 *                 optional `steps` field of a view row, left out when there are none, so a
 *                 standalone install sends no steps at all.
 * Depends on:     @smg/contracts (types), ../db/pool
 * Used by:        ../http/routes/matches, ../http/routes/rounds, ../league/boards, ../league/profiles
 * Spec:           docs/spec/07-integration.md §7; docs/spec/06-data-model-api-realtime.md §3.1
 */
import type { PlayerStepView } from '@smg/contracts';

import type { DbPool } from '../db/pool.js';

type StepsByKey = Readonly<Record<string, readonly PlayerStepView[]>>;

// Steps for player keys (account ids; a bot's key has none), only the keys that have some.
export async function playerSteps(pool: DbPool, keys: readonly string[]): Promise<StepsByKey> {
  const accounts = keys.filter((k) => !k.startsWith('bot-'));
  if (accounts.length === 0) return {};
  const r = await pool.query<{ id: string; steps: PlayerStepView[] }>(
    `SELECT id::text, steps FROM smg.accounts
     WHERE id::text = ANY($1) AND jsonb_array_length(steps) > 0`,
    [accounts],
  );
  return Object.fromEntries(r.rows.map((row) => [row.id, row.steps]));
}

// `{ steps }` for a row with steps, else nothing (the field is optional in the contract).
export function withSteps(steps: readonly PlayerStepView[] | undefined): {
  steps?: readonly PlayerStepView[];
} {
  return steps === undefined || steps.length === 0 ? {} : { steps };
}
