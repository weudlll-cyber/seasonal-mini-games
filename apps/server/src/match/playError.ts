/**
 * @file   apps/server/src/match/playError.ts
 * @module server/match
 * @brief  The refusals of the match and round use cases, with the code the answer carries.
 *
 * Responsibility: one error type for ./play's refusals: its code (mapped to an HTTP status
 *                 or an intent's answer), a sentence, and for ROUND_SETTINGS_INVALID the
 *                 refused setting's key, so the form shows the sentence under it (O74).
 * Depends on:     nothing
 * Used by:        ./play, ../http/routes/*, ../realtime/intents
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.1, §4.3
 */

export type PlayCode =
  | 'ROUND_RUNNING'
  | 'ROUND_SETTINGS_INVALID'
  | 'IN_SEASON_UNAVAILABLE'
  | 'NOT_A_HALVING_DAY'
  | 'TEAMS_LOCKED'
  | 'TEAM_LOCKED'
  | 'TEAMS_OFF'
  | 'MATCH_CLOSED';

export class PlayError extends Error {
  constructor(
    readonly code: PlayCode,
    readonly detail: string = code,
    readonly field: string | null = null, // ROUND_SETTINGS_INVALID: the refused setting (O74)
  ) {
    super(detail);
  }
}
