/**
 * @file   apps/web/src/match/ChatDock.tsx
 * @module web/match
 * @brief  The match chat docked under the round view and the result (a game's `chatDock`
 *         'below', owner decision O97).
 *
 * Responsibility: one place for the match chat while a round runs and after it, mounted once
 *                 for both, so its room and what was typed survive the switch from the round
 *                 to the result and back (07 §2; ./DockedMatch keeps this component at the same
 *                 place of the page). On a desktop a full-width strip of fixed height under
 *                 the view (./chatDock.css), always in sight. On a phone a bar at the bottom
 *                 with the newest message's start ("bot-01: hello the…") and the unread count,
 *                 which opens the chat as a sheet over the view, as the round bar's panels do
 *                 on a phone (../round/focus.css); its Close button or Escape closes it and
 *                 hands the focus back to the bar. Unread counts another player's messages that
 *                 arrive while the sheet is closed (../chat/chatArrivals); a host's embedded chat
 *                 is told whether it is in sight and gives its own count (`HostChatSight`,
 *                 T237). The same element holds the chat in both layouts, so turning a phone
 *                 does not reload it either.
 * Depends on:     react, @smg/ui (useDisclosure), ../chat/chatArrivals, ../round/FocusIcons,
 *                 ./chatDock.css
 * Used by:        ./DockedMatch
 * Spec:           docs/spec/02e-game-mind-games.md §11; docs/spec/07-integration.md §2
 */
import { useDisclosure, type Disclosure } from '@smg/ui';
import { useCallback, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';

import { ChatArrivals, HostChatSight, type ChatArrival } from '../chat/chatArrivals.js';
import { FocusIcon } from '../round/FocusIcons.js';
import './chatDock.css';

// The unread count while the chat is out of sight, and the newest message by another player.
function useArrivals(visible: boolean) {
  const [unread, setUnread] = useState(0);
  const [newest, setNewest] = useState<ChatArrival | null>(null);
  const seen = useRef(visible);
  seen.current = visible;
  const arrived = useCallback((m: ChatArrival) => {
    setNewest(m);
    if (!seen.current) setUnread((n) => n + 1);
  }, []);
  const sight = useMemo(() => ({ visible, unread: setUnread }), [visible]);
  const clear = (): void => {
    setUnread(0);
  };
  return { unread, newest, arrived, sight, clear };
}

// The bar's words: the newest message's author and text, else plainly "Chat".
const barText = (m: ChatArrival | null): string =>
  m === null || m.text === null ? 'Chat' : `${m.author ?? 'Someone'}: ${m.text}`;

// The phone's bar: the chat icon, the newest message's start and the unread count.
function ChatBar(p: {
  readonly sheet: Disclosure;
  readonly newest: ChatArrival | null;
  readonly unread: number;
  readonly onClick: () => void;
}): ReactElement {
  return (
    <button
      ref={p.sheet.button}
      type="button"
      className="chat-dock-bar"
      aria-expanded={p.sheet.open}
      aria-controls={p.sheet.panelId}
      data-testid="chat-dock-bar"
      onClick={p.onClick}
    >
      <FocusIcon name="chat" />
      <span className="chat-dock-newest">{barText(p.newest)}</span>
      {p.unread === 0 ? null : (
        <span className="focus-badge chat-dock-badge" data-testid="chat-dock-unread">
          {p.unread}
          <span className="smg-visually-hidden"> unread</span>
        </span>
      )}
    </button>
  );
}

export function ChatDock(p: {
  readonly chat: ReactNode;
  readonly phone: boolean;
}): ReactElement | null {
  const sheet = useDisclosure();
  const a = useArrivals(!p.phone || sheet.open);
  if (p.chat === null) return null;
  const toggle = (): void => {
    if (!sheet.open) a.clear();
    sheet.toggle();
  };
  return (
    <ChatArrivals.Provider value={a.arrived}>
      <HostChatSight.Provider value={a.sight}>
        <section
          className="chat-dock"
          aria-label="Chat"
          data-view={p.phone ? 'phone' : 'desktop'}
          data-open={sheet.open}
          data-testid="chat-dock"
          onKeyDown={sheet.onKeyDown}
        >
          {p.phone ? (
            <ChatBar sheet={sheet} newest={a.newest} unread={a.unread} onClick={toggle} />
          ) : null}
          {/* The chat itself, the same element on a desktop and in the phone's sheet. */}
          <div
            id={sheet.panelId}
            className="chat-dock-body"
            role={p.phone ? 'dialog' : undefined}
            aria-label={p.phone ? 'Chat' : undefined}
            hidden={p.phone && !sheet.open}
          >
            {p.phone ? (
              <header className="focus-panel-head">
                <h2>Chat</h2>
                <button type="button" className="smg-btn" onClick={sheet.close}>
                  Close
                </button>
              </header>
            ) : null}
            {p.chat}
          </div>
        </section>
      </HostChatSight.Provider>
    </ChatArrivals.Provider>
  );
}
