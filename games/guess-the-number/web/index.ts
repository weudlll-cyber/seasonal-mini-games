/**
 * @file   games/guess-the-number/web/index.ts
 * @module games/guess-the-number/web
 * @brief  The screens of Guess The Number for the player client.
 *
 * Responsibility: the game's player panel and input row, spectator and result panels, its
 *                 text and its setting definitions (for the forms' labels and help), for one
 *                 line in the registry's web half (04 §4.6).
 * Depends on:     @smg-game/guess-the-number (settings), ./PlayerPanel, ./SpectatorPanel,
 *                 ./ResultPanel, ./text, ./gtn.css
 * Used by:        games/registry/web
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02-game-guess-the-number.md §12
 */
import { gtnSettings } from '@smg-game/guess-the-number';

import './gtn.css';

// The game's own setting definitions (labels and help), for the client's forms.
export const gtnSettingDefs = gtnSettings.defs;

export { GuessInput, PlayerPanel } from './PlayerPanel.js';
export { ResultPanel } from './ResultPanel.js';
export { SpectatorPanel } from './SpectatorPanel.js';
export { gtnText } from './text.js';
