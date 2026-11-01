/**
 * @file   apps/server/src/league/rules.ts
 * @module server/league
 * @brief  The league's settings as the server applies them, read from the settings service.
 *
 * Responsibility: `leaderboard.minPlayersForPoints` (O11) and
 *                 `leaderboard.abortedMatchesCount` (O31) from the `matchmaking` document,
 *                 read when a round ends or a match is aborted.
 * Depends on:     @smg/application (SettingsService), ./awards
 * Used by:        ../round/runtime, ../match/play
 * Spec:           docs/spec/08-admin-settings.md §4
 */
import type { SettingsService } from '@smg/application';

import type { LeagueRules } from './awards.js';

export interface LeagueSettings extends LeagueRules {
  readonly abortedMatchesCount: boolean;
}

export async function leagueRules(settings: SettingsService): Promise<LeagueSettings> {
  const v = await settings.values('matchmaking');
  return {
    minPlayers: v['leaderboard.minPlayersForPoints'] as number,
    abortedMatchesCount: v['leaderboard.abortedMatchesCount'] as boolean,
  };
}
