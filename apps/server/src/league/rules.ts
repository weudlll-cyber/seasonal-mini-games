/**
 * @file   apps/server/src/league/rules.ts
 * @module server/league
 * @brief  The league's settings as the server applies them, read from the settings service.
 *
 * Responsibility: `leaderboard.minPlayersForPoints` (O11), `leaderboard.firstQuarterSeason`
 *                 and `leaderboard.abortedMatchesCount` (proposals, OPEN (t), (u)) from the
 *                 `matchmaking` document, read when a round ends or a match is aborted.
 * Depends on:     @smg/application (SettingsService), @smg/game-sdk (Season), ./awards
 * Used by:        ../round/runtime, ../match/play
 * Spec:           docs/spec/08-admin-settings.md §4
 */
import type { SettingsService } from '@smg/application';
import type { Season } from '@smg/game-sdk';

import type { LeagueRules } from './awards.js';

export interface LeagueSettings extends LeagueRules {
  readonly abortedMatchesCount: boolean;
}

export async function leagueRules(settings: SettingsService): Promise<LeagueSettings> {
  const v = await settings.values('matchmaking');
  return {
    minPlayers: v['leaderboard.minPlayersForPoints'] as number,
    firstQuarterSeason: v['leaderboard.firstQuarterSeason'] as Season,
    abortedMatchesCount: v['leaderboard.abortedMatchesCount'] as boolean,
  };
}
