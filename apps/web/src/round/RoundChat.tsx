/**
 * @file   apps/web/src/round/RoundChat.tsx
 * @module web/round
 * @brief  The match chat between rounds: a panel under the waiting area, over the page from a
 *         "Chat" button on a phone.
 *
 * Responsibility: between rounds the match page puts the chat under the waiting area, apart
 *                 from it (T116): on a wide screen a card of its own height whose list scrolls
 *                 inside itself; on a phone a "Chat" button opens it as a panel over the page,
 *                 from under the app bar to just above the button, measured when it opens; the
 *                 button ("Close chat") or Escape closes it again. The chat stays mounted
 *                 either way, so it keeps its room and what was typed (07 §2). While a round
 *                 runs the chat is a panel of the focus mode instead (./FocusShell, O46).
 * Depends on:     react, @smg/ui (useDisclosure), ./roundChat.css
 * Used by:        ../match/MatchPage
 * Spec:           docs/spec/07-integration.md §2; docs/spec/02-game-guess-the-number.md §12
 */
import { useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { useDisclosure } from '@smg/ui';

import './roundChat.css';

// Where the panel lies on a phone: between the app's bar and the Chat button, so the button
// (to close it) stays in view.
function overlayBox(button: HTMLElement): CSSProperties {
  const top = document.querySelector('.shell-bar');
  const gap = 8;
  return {
    top: `${String(Math.round((top?.getBoundingClientRect().bottom ?? 0) + gap))}px`,
    bottom: `${String(Math.round(window.innerHeight - button.getBoundingClientRect().top + gap))}px`,
  };
}

export function RoundChat({ chat }: { readonly chat: ReactNode }): ReactElement | null {
  const panel = useDisclosure();
  const [box, setBox] = useState<CSSProperties>({});
  if (chat === null) return null;
  const toggle = (): void => {
    if (!panel.open && panel.button.current !== null) setBox(overlayBox(panel.button.current));
    panel.toggle();
  };
  return (
    <section
      className="round-chat"
      aria-labelledby="round-chat-title"
      data-open={panel.open}
      data-testid="round-chat"
      onKeyDown={panel.onKeyDown}
    >
      <div className="round-chat-head">
        <h2 id="round-chat-title">Chat</h2>
        <button
          ref={panel.button}
          type="button"
          className="smg-btn round-chat-toggle"
          aria-expanded={panel.open}
          aria-controls={panel.panelId}
          data-testid="round-chat-toggle"
          onClick={toggle}
        >
          {panel.open ? 'Close chat' : 'Chat'}
        </button>
      </div>
      <div id={panel.panelId} className="round-chat-body" style={box}>
        {chat}
      </div>
    </section>
  );
}
