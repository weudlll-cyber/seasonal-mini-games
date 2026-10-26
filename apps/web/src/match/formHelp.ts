/**
 * @file   apps/web/src/match/formHelp.ts
 * @module web/match
 * @brief  The help lines of the round forms' fields that are not settings.
 *
 * Responsibility: one wording for the fields the host's round form and the Quick Test show
 *                 beside the settings (whose help comes from their definitions, 08 §3): the
 *                 season in both forms, and the Quick Test's seed, bots and fast specials.
 *                 Each is one line under its field, visible without hover.
 * Depends on:     nothing
 * Used by:        ./roundFields, ../shell/QuickTest
 * Spec:           docs/spec/08-admin-settings.md §3; docs/spec/11-roadmap.md (Quick Test)
 */

export const FORM_HELP = {
  season: "The season sets the round's colours and its special.",
  seed: 'The same word gives the same number and season; empty means random.',
  bots: 'Players run by the server; they guess from their own answers.',
  fast: 'Specials every few seconds instead of every half minute.',
} as const;
