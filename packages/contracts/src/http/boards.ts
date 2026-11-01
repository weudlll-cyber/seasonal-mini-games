/**
 * @file   packages/contracts/src/http/boards.ts
 * @module contracts/http
 * @brief  Shapes of the boards: match standings, season and all-time boards, teams, profiles.
 *
 * Responsibility: what `GET /leaderboards`, `/leaderboards/:periodId` (with `/me` and
 *                 `/teams`), `/players/:displayName` and the match standings answer, and the
 *                 body of a leaderboard adjustment. Players appear by display name only, never
 *                 by e-mail (Bingo 01 §10). Ranks are shared on equal points, wins and solves.
 * Depends on:     zod, ./play (TeamName)
 * Used by:        ../index, apps/server, apps/web, apps/admin
 * Spec:           docs/spec/06-data-model-api-realtime.md §2.6, §3.1; Bingo 05 §2.2, §2.4
 */
import { z } from 'zod';

import type { TeamName } from './play.js';

export interface LeaderboardPeriodView {
  readonly id: string;
  readonly kind: 'season' | 'all_time';
  readonly name: string;
  readonly startsAt: number;
  readonly endsAt: number | null;
  readonly status: 'active' | 'closed';
}

export interface LeaderboardRowView {
  readonly rank: number;
  readonly displayName: string;
  readonly points: number;
  readonly wins: number;
  readonly solves: number;
  readonly matches: number;
  // The viewer's own row.
  readonly you: boolean;
}

export interface LeaderboardPageView {
  readonly period: LeaderboardPeriodView;
  readonly rows: readonly LeaderboardRowView[];
  // The offset of the next page, or null on the last page.
  readonly next: number | null;
}

export interface TeamLeagueRowView {
  readonly rank: number;
  readonly team: TeamName;
  readonly points: number;
  readonly wins: number;
}

// One line of a match's standings: the sum over the match's ended rounds (02 §9).
export interface MatchStandingView {
  readonly rank: number;
  readonly playerKey: string;
  readonly name: string;
  readonly points: number;
  readonly wins: number;
}

export interface PlayerProfileView {
  readonly displayName: string;
  readonly memberSince: number;
  // Over every match that counts for the leaderboard and was not taken back.
  readonly matchesPlayed: number;
  readonly roundsPlayed: number;
  readonly wins: number;
  readonly solves: number;
  readonly bestPlace: number | null;
  readonly boards: readonly {
    readonly period: LeaderboardPeriodView;
    readonly rank: number | null;
    readonly points: number;
  }[];
  readonly recent: readonly {
    readonly matchCode: string;
    readonly matchTitle: string;
    readonly roundId: string;
    readonly endedAt: number;
    readonly secretMode: 'shared' | 'individual';
    readonly place: number | null;
    readonly solved: boolean;
    readonly points: number;
  }[];
  // Staff corrections are public on the profile (Bingo 03 §11).
  readonly adjustments: readonly {
    readonly periodName: string;
    readonly delta: number;
    readonly reason: string;
    readonly at: number;
  }[];
}

export const AdjustmentBody = z.object({
  periodId: z.uuid(),
  displayName: z.string().min(3).max(24),
  delta: z
    .number()
    .int()
    .min(-10_000)
    .max(10_000)
    .refine((d) => d !== 0, 'not zero'),
  reason: z.string().trim().min(3).max(500),
});
export type Adjustment = z.infer<typeof AdjustmentBody>;
