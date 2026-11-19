/**
 * @file   apps/server/src/league/standingsTies.ts
 * @module server/league
 * @brief  A game's rule for equal match totals, and the listing order of a shared place.
 *
 * Responsibility: the game module's `meta.standingsTies` by the match's game (owner decision
 *                 O100): 'shared-by-name' for a game whose equal totals share a place (Seasonal
 *                 Mind Games), else the default 'wins' (round wins, then the earliest win,
 *                 02 §9); and, for a shared place, its players by display name, case-insensitive
 *                 and locale-aware, the player number last so the order is stable (T369). The
 *                 ranks themselves come from @smg/domain `standings`; nothing is ranked here.
 * Depends on:     @smg-game/registry (the installed games), @smg/domain (StandingsTies),
 *                 @smg/game-sdk (compareNames, O102)
 * Used by:        ../round/pgResults (the standings' ranks), ./boards (the standings' listing)
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/02e-game-mind-games.md §9
 */
import { GAMES } from '@smg-game/registry';
import type { StandingsTies } from '@smg/domain';
import { compareNames } from '@smg/game-sdk';

// The rule of the match's game; a game no longer installed keeps the default.
export const tiesOf = (gameId: string): StandingsTies =>
  GAMES.find((g) => g.id === gameId)?.use((e) => e.module.meta.standingsTies) ?? 'wins';

// Rows in rank order, a shared place listed by name (the player number last).
export function byRankThenName<T extends { rank: number; name: string; key: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(
    (a, b) => a.rank - b.rank || compareNames(a.name, b.name) || (a.key < b.key ? -1 : 1),
  );
}
