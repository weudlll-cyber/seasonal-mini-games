/**
 * @file   games/seasonal-target/web/index.ts
 * @module games/seasonal-target/web
 * @brief  The screens of Seasonal Target for the player client.
 *
 * Responsibility: the game's panel (legend, hint, fallen tiles) and input (the tile grid with
 *                 its selection, drawn into the stage, and the input row), the phone's info line,
 *                 the spectator and result panels, its text and its setting definitions, as one object shaped like
 *                 the registry's `GameWeb` (04 §4.6).
 * Depends on:     @smg-game/seasonal-target (settings), ./PlayerPanel, ./TargetInput,
 *                 ./SpectatorPanel, ./ResultPanel, ./text, ./st.css, ./tiles.css
 * Used by:        games/registry/web
 * Spec:           docs/spec/04-software-architecture.md §4.6; docs/spec/02d-game-seasonal-target.md §11
 */
import { stSettings } from '@smg-game/seasonal-target';

import { InfoLine, PlayerPanel } from './PlayerPanel.js';
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
  Line: InfoLine,
  Result: ResultPanel,
  text: stText,
  settings: stSettings.defs,
  // The grid is the input: the platform's board layout hands the input its stage, the left
  // column at full height, to draw the grid into (T123, O51).
  layout: 'board' as const,
};
