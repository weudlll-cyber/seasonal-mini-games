/**
 * @file   apps/web/src/match/DockedMatch.tsx
 * @module web/match
 * @brief  The match page of a game that docks its chat (`meta.chatDock` 'below', O97): the
 *         round view or the result above, the chat under it, one screen.
 *
 * Responsibility: from the countdown through the result and the pause to the next round, one
 *                 box in focus mode (the app header hidden, ../round/focus.css) a screen high:
 *                 what the match page shows now (the round view, "Loading the round…", the
 *                 result with the next round's box) on top, taking the height the chat leaves,
 *                 and the docked chat (./ChatDock) under it. The chat keeps its place in this
 *                 box whatever is above it, so it is mounted once and keeps its room and what
 *                 was typed between the round and the result (07 §2). The layout, desktop or
 *                 phone, is the round view's (../round/useRoundView, T141).
 * Depends on:     react, ../round/useRoundView, ./ChatDock, ./docked.css
 * Used by:        ./MatchPage
 * Spec:           docs/spec/02e-game-mind-games.md §11; docs/spec/07-integration.md §2
 */
import type { ReactElement, ReactNode } from 'react';

import { useRoundView } from '../round/useRoundView.js';
import { ChatDock } from './ChatDock.js';
import './docked.css';

export function DockedMatch(p: {
  readonly phase: 'live' | 'loading' | 'after';
  // The match chat, or null without one (the provider `none`).
  readonly chat: ReactNode;
  readonly children: ReactNode;
}): ReactElement {
  const view = useRoundView();
  return (
    <div
      className="match-docked one-screen focus-mode"
      data-testid="match"
      data-phase={p.phase}
      data-view={view}
    >
      <div className="match-docked-main">{p.children}</div>
      <ChatDock chat={p.chat} phone={view === 'phone'} />
    </div>
  );
}
