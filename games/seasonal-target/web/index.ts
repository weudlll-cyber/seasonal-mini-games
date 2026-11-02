/**
 * @file   games/seasonal-target/web/index.ts
 * @module games/seasonal-target/web
 * @brief  The screens of Seasonal Target for the player client.
 *
 * Responsibility: the game's main-area panel and input (the tile grid with its selection), the
 *                 spectator and result panels, its text and its setting definitions, as one
 *                 object shaped like the registry's `GameWeb` (04 §4.6).
 * Depends on:     @smg-game/seasonal-target (settings), ./PlayerPanel, ./TargetInput,
 *                 ./SpectatorPanel, ./ResultPanel, ./text, ./st.css, ./tiles.css
 * Used by:        games/registry/web
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02d-game-seasonal-target.md §11
 */
import { stSettings } from '@smg-game/seasonal-target';

import { PlayerPanel } from './PlayerPanel.js';
import { ResultPanel } from './ResultPanel.js';
import { SpectatorPanel } from './SpectatorPanel.js';
import { TargetInput } from './TargetInput.js';
import { stText } from './text.js';
import './st.css';
import './tiles.css';

export const seasonalTargetWeb = {
  Player: PlayerPanel,
  Input: TargetInput,
  Spectator: SpectatorPanel,
  Result: ResultPanel,
  text: stText,
  settings: stSettings.defs,
  // The grid is the input: the platform's board layout gives it the stage's full height (T123).
  layout: 'board' as const,
};
