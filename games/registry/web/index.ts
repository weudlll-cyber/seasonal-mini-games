/**
 * @file   games/registry/web/index.ts
 * @module games/registry/web
 * @brief  The registered games' screens, for the player client.
 *
 * Responsibility: one line per game (04 §4.6), its panels bound to React components with
 *                 the props of `@smg/game-sdk`: the player's panel, input row and phone info line
 *                 apart, so the client can lay them out (the input row pinned at the bottom of
 *                 a phone, T141) and put its cooldown ring into the row. The player client finds a game's
 *                 screens only here, by the round's game id.
 * Depends on:     react (types), @smg/game-sdk, @smg-game/guess-the-number/web,
 *                 @smg-game/safecracker/web, @smg-game/bomb-defusal/web,
 *                 @smg-game/seasonal-target/web, @smg-game/mind-games/web
 * Used by:        apps/web
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/10-repository-structure.md §1
 */
import {
  GuessInput,
  gtnSettingDefs,
  gtnText,
  InfoLine,
  PlayerPanel,
  ResultPanel,
  SpectatorPanel,
} from '@smg-game/guess-the-number/web';
import { bombDefusalWeb } from '@smg-game/bomb-defusal/web';
import { mindGamesWeb } from '@smg-game/mind-games/web';
import { safecrackerWeb } from '@smg-game/safecracker/web';
import { seasonalTargetWeb } from '@smg-game/seasonal-target/web';
import type {
  FieldState,
  GameText,
  SettingDef,
  SettingValue,
  PlayerPanelProps,
  PrefsPanelProps,
  ResultPanelProps,
  SpectatorPanelProps,
} from '@smg/game-sdk';
import type { ComponentType, ReactNode } from 'react';

export interface GameWeb {
  readonly Player: ComponentType<PlayerPanelProps>;
  // The input row; `ring` is the platform's cooldown ring, drawn at its start. A board game
  // gets `stage`, the box at full height on the left (on a phone above the input row), and
  // draws its board there through a portal; the row itself stays in the right column (O51).
  readonly Input: ComponentType<
    PlayerPanelProps & { readonly ring?: ReactNode; readonly stage?: HTMLElement | null }
  >;
  readonly Spectator: ComponentType<SpectatorPanelProps>;
  // The phone's info line over the stage (T141): one line of what matters for the next guess
  // (the range and the fallen numbers, the digit strip, the hint or the halved area), from a
  // player's or a spectator's view; a tap opens the game's panel as a sheet.
  readonly Line: ComponentType<SpectatorPanelProps>;
  readonly Result: ComponentType<ResultPanelProps>;
  readonly text: GameText;
  // The game's own setting definitions: one wording for every form that shows them.
  readonly settings: readonly SettingDef[];
  // 'board': the game's board takes the stage, the left column at full height on a desktop,
  // with its panel, the list and the action dock in the info column on the right (T123, O51,
  // T141); by default the stage holds the round's guesses with the dock at its bottom.
  readonly layout?: 'board';
  // True: a round can have 20 players or more, so the list and the Players panel give each
  // player their tag and marker (`marksOf`), the game gets them as `marks`, and a row and the
  // game's board highlight the same player (O62).
  readonly playerTags?: true;
  // A phased game's panel in the waiting area for the viewer's own value (its pre-picks, 04
  // §4.8 rule 8); the platform shows it to the match's players and saves what it hands back.
  readonly Prefs?: ComponentType<PrefsPanelProps>;
  // How the host form shows one of the game's settings now, from the form's values and whether
  // it sets up the match's first round (02e §3, T335); null keeps the definition's.
  readonly fieldState?: (
    key: string,
    values: Readonly<Record<string, SettingValue>>,
    firstRound: boolean,
  ) => FieldState | null;
}

export const GAME_SCREENS: Readonly<Record<string, GameWeb>> = {
  'guess-the-number': {
    Player: PlayerPanel,
    Input: GuessInput,
    Spectator: SpectatorPanel,
    Line: InfoLine,
    Result: ResultPanel,
    text: gtnText,
    settings: gtnSettingDefs,
  },
  safecracker: safecrackerWeb,
  'bomb-defusal': bombDefusalWeb,
  'seasonal-target': seasonalTargetWeb,
  'mind-games': mindGamesWeb,
};
