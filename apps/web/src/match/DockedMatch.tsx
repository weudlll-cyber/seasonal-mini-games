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
 *                 and the docked chat under it: the kit's `DockedScreen` (its strip on a
 *                 desktop; on a phone its bar with the sheet, the page the visible viewport's
 *                 height, `--sk-visible-height`, so the bar stays above the on-screen keyboard,
 *                 MG-N8, T364). The chat keeps its place in this box whatever is above it, so it
 *                 is mounted once and keeps its room and what was typed between the round and
 *                 the result (07 §2); what is above it keeps its state when the chat arrives. The bar's form is the game's (`meta.chatBar`): in the form
 *                 'field' the room's own field with Send (../chat/ChatRoom `Writer`, offered
 *                 through `ChatComposerSlot`, T363) sits under the bar. On a phone the content
 *                 scrolls alone above the chat bar (a list game's running round fills it
 *                 instead, its guesses scrolling inside, O109; ./docked.css). Without a chat
 *                 (the provider `none`) there is no dock: the kit's `withoutChat`. In website mode
 *                 the dock's call place holds the website's one shared call while it is live (the
 *                 kit's `onSharedCall`, K77; its id to ./ResultBar through ./sharedCall);
 *                 standalone nothing is framed.
 * Depends on:     react, @seasonal/kit/react (DockedScreen), @seasonal/kit (dock.css, call.css),
 *                 ../chat/chatArrivals (ChatComposerSlot), ../chat/ChatRoom (Writer),
 *                 ../shell/session (useWebsiteMode), ./sharedCall, ./docked.css
 * Used by:        ./MatchPage
 * Spec:           docs/spec/02e-game-mind-games.md §11; docs/spec/02-game-guess-the-number.md §12;
 *                 docs/spec/07-integration.md §2
 */
import { DockedScreen } from '@seasonal/kit/react';
import { useState, type ReactElement, type ReactNode } from 'react';

import { ChatComposerSlot, type ChatComposer } from '../chat/chatArrivals.js';
import { Writer } from '../chat/ChatRoom.js';
import { useWebsiteMode } from '../shell/session.js';
import { SharedCallContext } from './sharedCall.js';
import '@seasonal/kit/dock.css';
import '@seasonal/kit/call.css';
import './docked.css';

export function DockedMatch(p: {
  readonly phase: 'live' | 'loading' | 'after';
  // The match chat, or null without one (the provider `none`).
  readonly chat: ReactNode;
  // The phone bar's form, the game's (O109).
  readonly bar: 'field' | 'line';
  readonly children: ReactNode;
}): ReactElement {
  // The room's writing part, for the phone bar's own field (T363).
  const [composer, setComposer] = useState<ChatComposer | null>(null);
  // The website's shared call, if one is live (website mode only: standalone there is no
  // website to frame).
  const website = useWebsiteMode();
  const [call, setCall] = useState<number | null>(null);
  const field =
    composer?.send == null ? null : (
      <Writer room={composer.room} send={composer.send} placeholder="Write a message…" />
    );
  // Without a chat there is no dock, but the page still follows the on-screen keyboard (T416).
  const dock =
    p.chat === null
      ? { withoutChat: true as const }
      : {
          chat: p.chat,
          bar: p.bar,
          field,
          callId: null,
          onSharedCall: website ? setCall : undefined,
        };
  // Only the form 'field' has a field in its bar, so only then the room offers its writer (and
  // hides its own in the open sheet, ../chat/ChatRoom).
  const offers = p.chat !== null && p.bar === 'field';
  // One tree with and without a chat: what is shown above keeps its state (an open panel) when
  // the chat's settings arrive after it.
  return (
    <div className="match-docked one-screen focus-mode" data-testid="match" data-phase={p.phase}>
      <ChatComposerSlot.Provider value={offers ? setComposer : null}>
        <DockedScreen {...dock}>
          <SharedCallContext.Provider value={call}>{p.children}</SharedCallContext.Provider>
        </DockedScreen>
      </ChatComposerSlot.Provider>
    </div>
  );
}
