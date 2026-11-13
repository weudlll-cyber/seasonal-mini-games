/**
 * @file   games/mind-games/web/index.ts
 * @module games/mind-games/web
 * @brief  The screens of Seasonal Mind Games for the player client.
 *
 * Responsibility: the player's stage (phase strip, choice buttons, Hide my switches) drawn
 *                 into the round's stage, the feed's head in the info column and on a phone,
 *                 the spectator's stage, the result, the pre-picks panel of the waiting area
 *                 (02e §7), the game's text and its setting
 *                 definitions, as one object shaped like the registry's `GameWeb` (04 §4.6).
 *                 The round's one list shows the feed's lines (./text).
 * Depends on:     @smg-game/mind-games (settings), ./FeedPanels, ./MindInput, ./PrefsPanel,
 *                 ./ResultPanel,
 *                 ./text, ./mind.css, ./result.css, ./flights.css
 * Used by:        games/registry/web
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02e-game-mind-games.md §11
 */
import { mindSettings } from '@smg-game/mind-games';

import { MindLine, MindPlayer, MindSpectator } from './FeedPanels.js';
import { MindInput } from './MindInput.js';
import { PrefsPanel } from './PrefsPanel.js';
import { ResultPanel } from './ResultPanel.js';
import { mindText } from './text.js';
import './mind.css';
import './result.css';
import './flights.css';

export const mindGamesWeb = {
  Player: MindPlayer,
  Input: MindInput,
  Spectator: MindSpectator,
  Line: MindLine,
  Result: ResultPanel,
  text: mindText,
  settings: mindSettings.defs,
  // Your pre-picks in the waiting area (02e §7).
  Prefs: PrefsPanel,
  // The choices are the stage: the board layout hands the input the stage, the left column at
  // full height, with the feed's head, the lines and the dock in the info column (O51).
  layout: 'board' as const,
};
