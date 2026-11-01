/**
 * @file   games/bomb-defusal/web/index.ts
 * @module games/bomb-defusal/web
 * @brief  The screens of Seasonal Bomb Defusal for the player client.
 *
 * Responsibility: the game's bomb block (player and spectator), its input row, its result
 *                 panel, its text and its setting definitions (for the forms' labels and help),
 *                 as one value shaped like the registry's `GameWeb` (04 §4.6).
 * Depends on:     @smg-game/bomb-defusal (settings), ./panels, ./ResultPanel, ./text,
 *                 ./WireInput, ./bd.css
 * Used by:        games/registry/web
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02c-game-bomb-defusal.md §11
 */
import { bdSettings } from '@smg-game/bomb-defusal';

import './bd.css';

import { PlayerPanel, SpectatorPanel } from './panels.js';
import { ResultPanel } from './ResultPanel.js';
import { bdText } from './text.js';
import { WireInput } from './WireInput.js';

export const bombDefusalWeb = {
  Player: PlayerPanel,
  Input: WireInput,
  Spectator: SpectatorPanel,
  Result: ResultPanel,
  text: bdText,
  settings: bdSettings.defs,
};
