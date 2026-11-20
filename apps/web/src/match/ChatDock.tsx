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
 *                 the view (./chatDock.css), always in sight. On a phone the bar at the bottom of
 *                 the screen, part of the layout (MG-N8, O99): "Chat · <newest message>" with the
 *                 unread count, which opens the chat as a sheet above the bar. In the bar's form
 *                 'field' (the game's `meta.chatBar` absent, Seasonal Mind Games) under it the
 *                 room's own field with Send (./ChatRoom `Writer`, offered through
 *                 `ChatComposerSlot`, T363), which sends without opening the sheet, so the sheet
 *                 holds the messages only; in the form 'line' (the list games, O109) the bar is
 *                 that one line and the sheet holds the whole chat with its field. The newest
 *                 message comes through the same slot in both. Its Close button or Escape
 *                 closes the sheet and hands the focus back to the bar. Unread counts another
 *                 player's messages that arrive while the sheet is closed
 *                 (../chat/chatArrivals); a host's embedded chat is told
 *                 whether it is in sight and gives its own count (`HostChatSight`, T237); it has
 *                 no field of the platform's, so its bar has none either. The same element holds
 *                 the chat in both layouts, so turning a phone does not reload it.
 * Depends on:     react, @smg/ui (useDisclosure), ../chat/chatArrivals, ../chat/ChatRoom (Writer),
 *                 ./chatDock.css
 * Used by:        ./DockedMatch
 * Spec:           docs/spec/02e-game-mind-games.md §11; docs/spec/02-game-guess-the-number.md §12;
 *                 docs/spec/07-integration.md §2
 */
import { useDisclosure, type Disclosure } from '@smg/ui';
import { useCallback, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';

import {
  ChatArrivals,
  ChatComposerSlot,
  HostChatSight,
  type ChatArrival,
  type ChatComposer,
} from '../chat/chatArrivals.js';
import { Writer } from '../chat/ChatRoom.js';
import './chatDock.css';

// The unread count while the chat is out of sight.
function useArrivals(visible: boolean) {
  const [unread, setUnread] = useState(0);
  const seen = useRef(visible);
  seen.current = visible;
  const arrived = useCallback(() => {
    if (!seen.current) setUnread((n) => n + 1);
  }, []);
  const sight = useMemo(() => ({ visible, unread: setUnread }), [visible]);
  const clear = (): void => {
    setUnread(0);
  };
  return { unread, arrived, sight, clear };
}

// The bar's words after "Chat": the newest message's author and text (a system line its text
// alone), if any.
const barText = (m: ChatArrival | null): string | null => {
  if (m === null || m.text === null) return null;
  return m.author === null ? m.text : `${m.author}: ${m.text}`;
};

// The phone's bar: "Chat · <newest message>" and the unread count, opening the sheet; in the
// form 'field' under it the room's own field with Send (when the viewer may write), which sends
// without the sheet (T363); in the form 'line' nothing more, the sheet has the field (O109).
function PhoneBar(p: {
  readonly sheet: Disclosure;
  readonly unread: number;
  readonly onClick: () => void;
  readonly composer: ChatComposer | null;
  readonly bar: 'field' | 'line';
}): ReactElement {
  const newest = barText(p.composer?.newest ?? null);
  return (
    <>
      <button
        ref={p.sheet.button}
        type="button"
        className="chat-dock-bar"
        aria-expanded={p.sheet.open}
        aria-controls={p.sheet.panelId}
        data-testid="chat-dock-bar"
        onClick={p.onClick}
      >
        <span className="chat-dock-newest">
          <strong>Chat</strong>
          {newest === null ? null : <span className="chat-dock-last"> · {newest}</span>}
        </span>
        {p.unread === 0 ? null : (
          <span className="chat-dock-badge" data-testid="chat-dock-unread">
            {p.unread}
            <span className="smg-visually-hidden"> unread</span>
          </span>
        )}
      </button>
      {p.bar === 'line' || p.composer?.send == null ? null : (
        <Writer room={p.composer.room} send={p.composer.send} placeholder="Write a message…" />
      )}
    </>
  );
}

// The chat itself, the same element on a desktop and in the phone's sheet (with its head).
function Body(p: {
  readonly sheet: Disclosure;
  readonly phone: boolean;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <div
      id={p.sheet.panelId}
      className="chat-dock-body"
      role={p.phone ? 'dialog' : undefined}
      aria-label={p.phone ? 'Chat' : undefined}
      hidden={p.phone && !p.sheet.open}
    >
      {p.phone ? (
        <header className="focus-panel-head">
          <h2>Chat</h2>
          <button type="button" className="smg-btn" onClick={p.sheet.close}>
            Close
          </button>
        </header>
      ) : null}
      {p.children}
    </div>
  );
}

export function ChatDock(p: {
  readonly chat: ReactNode;
  readonly phone: boolean;
  // The phone bar's form, the game's (`meta.chatBar`): with the field, or one line (O109).
  readonly bar: 'field' | 'line';
}): ReactElement | null {
  const sheet = useDisclosure();
  const a = useArrivals(!p.phone || sheet.open);
  // The room's writing part, for the phone bar's own field (T363).
  const [composer, setComposer] = useState<ChatComposer | null>(null);
  if (p.chat === null) return null;
  const toggle = (): void => {
    if (!sheet.open) a.clear();
    sheet.toggle();
  };
  return (
    <ChatArrivals.Provider value={a.arrived}>
      <ChatComposerSlot.Provider value={setComposer}>
        <HostChatSight.Provider value={a.sight}>
          <section
            className="chat-dock"
            aria-label="Chat"
            data-view={p.phone ? 'phone' : 'desktop'}
            data-bar={p.bar}
            data-open={sheet.open}
            data-testid="chat-dock"
            onKeyDown={sheet.onKeyDown}
          >
            {p.phone ? (
              <PhoneBar
                sheet={sheet}
                unread={a.unread}
                onClick={toggle}
                composer={composer}
                bar={p.bar}
              />
            ) : null}
            <Body sheet={sheet} phone={p.phone}>
              {p.chat}
            </Body>
          </section>
        </HostChatSight.Provider>
      </ChatComposerSlot.Provider>
    </ChatArrivals.Provider>
  );
}
