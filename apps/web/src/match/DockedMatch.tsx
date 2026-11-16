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
 *                 phone, is the round view's (../round/useRoundView, T141); on a phone the
 *                 content scrolls alone above the chat bar and the page is the visible viewport's
 *                 height, so the bar stays above the on-screen keyboard (MG-N8, T364).
 * Depends on:     react, ../round/useRoundView, ./ChatDock, ./docked.css
 * Used by:        ./MatchPage
 * Spec:           docs/spec/02e-game-mind-games.md §11; docs/spec/07-integration.md §2
 */
import { useEffect, type ReactElement, type ReactNode } from 'react';

import { useRoundView } from '../round/useRoundView.js';
import { ChatDock } from './ChatDock.js';
import './docked.css';

// On a phone the screen is the visible viewport: when the on-screen keyboard takes part of it,
// the page shrinks with it, so the chat bar stays directly above the keyboard (T364). The app's
// root is a screen high (../shell/shell.css `.one-screen`); its height follows the viewport
// while this page is shown and is handed back after.
function useVisibleHeight(phone: boolean): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.getElementById('root');
    if (!phone || vv == null || root === null) return undefined;
    const follow = (): void => {
      root.style.height = `${String(Math.round(vv.height))}px`;
    };
    follow();
    vv.addEventListener('resize', follow);
    return () => {
      vv.removeEventListener('resize', follow);
      root.style.height = '';
    };
  }, [phone]);
}

export function DockedMatch(p: {
  readonly phase: 'live' | 'loading' | 'after';
  // The match chat, or null without one (the provider `none`).
  readonly chat: ReactNode;
  readonly children: ReactNode;
}): ReactElement {
  const view = useRoundView();
  useVisibleHeight(view === 'phone');
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
