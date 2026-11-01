/**
 * @file   games/registry/web/index.ts
 * @module games/registry/web
 * @brief  The registered games' screens, for the player client.
 *
 * Responsibility: one line per game (04 §4.6), its panels bound to React components with
 *                 the props of `@smg/game-sdk`: the player's main area and input row apart, so
 *                 the client can lay them out (the input row pinned at the bottom of a phone)
 *                 and put its cooldown ring into the row. The player client finds a game's
 *                 screens only here, by the round's game id.
 * Depends on:     react (types), @smg/game-sdk, @smg-game/guess-the-number/web,
 *                 @smg-game/safecracker/web, @smg-game/bomb-defusal/web,
 *                 @smg-game/seasonal-target/web
 * Used by:        apps/web
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/10-repository-structure.md §1
 */
import {
  GuessInput,
  gtnSettingDefs,
  gtnText,
  PlayerPanel,
  ResultPanel,
  SpectatorPanel,
} from '@smg-game/guess-the-number/web';
import { bombDefusalWeb } from '@smg-game/bomb-defusal/web';
import { safecrackerWeb } from '@smg-game/safecracker/web';
import { seasonalTargetWeb } from '@smg-game/seasonal-target/web';
import type {
  GameText,
  SettingDef,
  PlayerPanelProps,
  ResultPanelProps,
  SpectatorPanelProps,
} from '@smg/game-sdk';
import type { ComponentType, ReactNode } from 'react';

export interface GameWeb {
  readonly Player: ComponentType<PlayerPanelProps>;
  // The input row; `ring` is the platform's cooldown ring, drawn at its start.
  readonly Input: ComponentType<PlayerPanelProps & { readonly ring?: ReactNode }>;
  readonly Spectator: ComponentType<SpectatorPanelProps>;
  readonly Result: ComponentType<ResultPanelProps>;
  readonly text: GameText;
  // The game's own setting definitions: one wording for every form that shows them.
  readonly settings: readonly SettingDef[];
  // 'board': the input row is the game's board (a map), drawn as the left column at full
  // height on a desktop, with the list on the right (T123); by default the list leads.
  readonly layout?: 'board';
}

export const GAME_SCREENS: Readonly<Record<string, GameWeb>> = {
  'guess-the-number': {
    Player: PlayerPanel,
    Input: GuessInput,
    Spectator: SpectatorPanel,
    Result: ResultPanel,
    text: gtnText,
    settings: gtnSettingDefs,
  },
  safecracker: safecrackerWeb,
  'bomb-defusal': bombDefusalWeb,
  'seasonal-target': seasonalTargetWeb,
};
