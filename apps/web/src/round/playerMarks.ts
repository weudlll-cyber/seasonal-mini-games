/**
 * @file   apps/web/src/round/playerMarks.ts
 * @module web/round
 * @brief  The round's player marks (tag, colour, shape) for a game that names players by tag.
 *
 * Responsibility: for a game with `playerTags` (Seasonal Target, O62) every roster player's
 *                 mark in the roster's join order, "you" for the viewer, the same for the
 *                 list's rows, the Players panel and the game's own board (`marks`); none for
 *                 the other games, whose rows keep their dot.
 * Depends on:     @smg/contracts, @smg/game-sdk (marksOf), @smg-game/registry/web (types)
 * Used by:        ./RoundLog, ./InputRow, ./InfoParts, ./RoundScreen (the Players panel)
 * Spec:           docs/spec/02d-game-seasonal-target.md §11
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import { marksOf, type PlayerMark } from '@smg/game-sdk';

export function roundMarks(
  state: RoundStateView,
  game: GameWeb | null,
  viewerKey: string | null,
): Readonly<Record<string, PlayerMark>> | undefined {
  if (game?.playerTags !== true) return undefined;
  return marksOf(
    state.roster.map((r) => r.playerKey),
    viewerKey,
  );
}
