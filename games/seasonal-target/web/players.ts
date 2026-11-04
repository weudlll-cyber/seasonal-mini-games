/**
 * @file   games/seasonal-target/web/players.ts
 * @module games/seasonal-target/web
 * @brief  Every player's tag and marker on the grid, the same as the platform's list shows.
 *
 * Responsibility: the platform hands its marks (`marks`, in the roster's join order, "you"
 *                 for the viewer, O62); without them (a test, an older platform) the same
 *                 marks are made from the list's players, whose order is the roster's.
 * Depends on:     @smg/game-sdk (marksOf, props)
 * Used by:        ./TargetInput, ./SpectatorPanel, ./ResultPanel
 * Spec:           docs/spec/02d-game-seasonal-target.md §11
 */
import { marksOf, type PlayerMark } from '@smg/game-sdk';

interface WithPlayers {
  readonly colors: Readonly<Record<string, string>>;
  readonly marks?: Readonly<Record<string, PlayerMark>> | undefined;
  readonly viewerKey?: string | null | undefined;
}

// The viewer's own tiles where the platform named no viewer (a test): "you" on an ink ring.
export const YOU_MARK: PlayerMark = { tag: 'you', color: 'var(--color-text)', shape: 'ring' };

export const marksFor = (p: WithPlayers): Readonly<Record<string, PlayerMark>> =>
  p.marks ?? marksOf(Object.keys(p.colors), p.viewerKey ?? null);
