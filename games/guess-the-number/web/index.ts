/**
 * @file   games/guess-the-number/web/index.ts
 * @module games/guess-the-number/web
 * @brief  The screens of Guess The Number for the player client.
 *
 * Responsibility: the game's player, spectator and result panels and its text, for one line
 *                 in the registry's web half (04 §4.6).
 * Depends on:     ./PlayerPanel, ./SpectatorPanel, ./ResultPanel, ./text, ./gtn.css
 * Used by:        games/registry/web
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02-game-guess-the-number.md §12
 */
import './gtn.css';

export { PlayerPanel } from './PlayerPanel.js';
export { ResultPanel } from './ResultPanel.js';
export { SpectatorPanel } from './SpectatorPanel.js';
export { gtnText } from './text.js';
