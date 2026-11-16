/**
 * @file   apps/web/src/match/roundRequest.ts
 * @module web/match
 * @brief  The host form's request: a new round, or a series' next round during its pause.
 *
 * Responsibility: what the Host menu's round form sends. The settings carry `round.halving`
 *                 only where the game's document has that key (a phased game has none, 04 §4.8
 *                 rule 4); during a series' pause (rule 7) the form keeps the settings for the
 *                 next round, which the server starts by itself (`PUT …/next-round`), else it
 *                 creates the round (`POST …/rounds`, started at once when asked).
 * Depends on:     @smg/contracts, @smg/game-sdk (types)
 * Used by:        ./HostMenu
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1; docs/spec/04-software-architecture.md §4.8
 */
import type { MatchDetailsView } from '@smg/contracts';
import type { SettingValue } from '@smg/game-sdk';

export interface RoundRequestPlan {
  readonly path: string;
  readonly method: 'POST' | 'PUT';
  readonly body: Readonly<Record<string, unknown>>;
}

export function roundRequest(
  match: MatchDetailsView,
  form: {
    // The keys of the game's settings document.
    readonly keys: readonly string[];
    readonly values: Readonly<Record<string, SettingValue>>;
    readonly halving: boolean;
    readonly season: string;
  },
  startNow: boolean,
): RoundRequestPlan {
  const settings = form.keys.includes('round.halving')
    ? { ...form.values, 'round.halving': form.halving }
    : form.values;
  const season = form.season === 'inSeason' ? {} : { season: form.season };
  if (match.series?.nextAt != null) {
    return {
      path: `/matches/${match.code}/next-round`,
      method: 'PUT',
      body: { settings, ...season },
    };
  }
  return {
    path: `/matches/${match.code}/rounds`,
    method: 'POST',
    body: { settings, startNow, ...season },
  };
}
