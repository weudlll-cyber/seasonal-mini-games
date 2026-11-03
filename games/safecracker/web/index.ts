/**
 * @file   games/safecracker/web/index.ts
 * @module games/safecracker/web
 * @brief  The screens of Seasonal Safecracker for the player client.
 *
 * Responsibility: the game's player panel (the code block), input row (the digit boxes) and
 *                 phone info line, spectator and result panels, its text and its setting definitions (for the
 *                 forms' labels and help), as one `GameWeb` line for the registry's web half
 *                 (04 §4.6), and the game's styles.
 * Depends on:     @smg-game/safecracker (settings), ./Board, ./CodeInput, ./ResultPanel,
 *                 ./text, ./sc.css
 * Used by:        games/registry/web (once registered)
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02b-game-safecracker.md §10
 */
import { scSettings } from '@smg-game/safecracker';

import { InfoLine, PlayerPanel, SpectatorPanel } from './Board.js';
import { CodeInput } from './CodeInput.js';
import { ResultPanel } from './ResultPanel.js';
import { safecrackerText } from './text.js';

import './sc.css';

export const safecrackerWeb = {
  Player: PlayerPanel,
  Input: CodeInput,
  Spectator: SpectatorPanel,
  Line: InfoLine,
  Result: ResultPanel,
  text: safecrackerText,
  settings: scSettings.defs,
};
