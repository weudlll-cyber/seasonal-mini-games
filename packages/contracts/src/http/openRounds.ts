/**
 * @file   packages/contracts/src/http/openRounds.ts
 * @module contracts/http
 * @brief  The public open-rounds answer shared with the website (its docs/OPEN-ROUNDS.md, O124).
 *
 * Responsibility: version 1 of GET /api/public/open-rounds, the contract Seasonal Bingo Royale
 *                 and Seasonal Cases answer too: at most 20 entries whose sign-up is open and
 *                 that the host shows on the website, each with a stable id (the match code), a
 *                 title, a kind, a start and a sign-up close (ISO 8601 UTC or null), the player
 *                 counts and an absolute https join URL on the status URL's origin; no personal
 *                 data. The website ignores fields it does not know.
 * Depends on:     zod
 * Used by:        ../index, apps/server/src/http/routes/openRounds
 * Spec:           docs/spec/07-integration.md §8
 */
import { z } from 'zod';

const isoOrNull = z.iso.datetime().nullable();

export const openRound = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(80),
  kind: z.string().min(1).max(40),
  startsAt: isoOrNull,
  signupClosesAt: isoOrNull,
  players: z.number().int().min(0),
  maxPlayers: z.number().int().min(1).nullable(),
  joinUrl: z.url({ protocol: /^https$/ }),
});

export const openRoundsAnswer = z.object({
  version: z.literal(1),
  rounds: z.array(openRound).max(20),
});

export type OpenRound = z.infer<typeof openRound>;
export type OpenRoundsAnswer = z.infer<typeof openRoundsAnswer>;
