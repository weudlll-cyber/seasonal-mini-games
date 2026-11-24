/**
 * @file   apps/web/src/round/panels.ts
 * @module web/round
 * @brief  The focus mode's panels on demand (O46): their ids, for the kit's `usePanels`.
 *
 * Responsibility: the panels a round can open, one at a time: chat, players, host, a phased
 *                 game's pre-picks (O117), the whole list and a phone's game panel. Which one
 *                 is open, each opening button by id (closing hands the focus back to it) and
 *                 the one-at-a-time rule are the kit's `usePanels<PanelId>()`; Escape and the
 *                 panels' Close buttons call its `close` (./FocusPanel).
 * Depends on:     @seasonal/kit/react (Panels, type)
 * Used by:        ./FocusShell, ./FocusBar, ./RoundBody, ./InfoParts
 * Spec:           docs/spec/02-game-guess-the-number.md §12
 */
import type { Panels as KitPanels } from '@seasonal/kit/react';

export type PanelId = 'chat' | 'players' | 'host' | 'prefs' | 'list' | 'game';

export type Panels = KitPanels<PanelId>;
