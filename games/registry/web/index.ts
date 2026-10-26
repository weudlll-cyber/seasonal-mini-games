/**
 * @file   games/registry/web/index.ts
 * @module games/registry/web
 * @brief  The registered games' screens, for the player client.
 *
 * Responsibility: one line per game (04 §4.6), its panels bound to React components with
 *                 the props of `@smg/game-sdk`. The player client finds a game's screens only
 *                 here, by the round's game id.
 * Depends on:     react (types), @smg/game-sdk, @smg-game/guess-the-number/web
 * Used by:        apps/web
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/10-repository-structure.md §1
 */
import { gtnText, PlayerPanel, ResultPanel, SpectatorPanel } from '@smg-game/guess-the-number/web';
import type {
  GameText,
  PlayerPanelProps,
  ResultPanelProps,
  SpectatorPanelProps,
} from '@smg/game-sdk';
import type { ComponentType } from 'react';

export interface GameWeb {
  readonly Player: ComponentType<PlayerPanelProps>;
  readonly Spectator: ComponentType<SpectatorPanelProps>;
  readonly Result: ComponentType<ResultPanelProps>;
  readonly text: GameText;
}

export const GAME_SCREENS: Readonly<Record<string, GameWeb>> = {
  'guess-the-number': {
    Player: PlayerPanel,
    Spectator: SpectatorPanel,
    Result: ResultPanel,
    text: gtnText,
  },
};
