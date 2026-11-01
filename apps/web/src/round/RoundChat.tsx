/**
 * @file   apps/web/src/round/RoundChat.tsx
 * @module web/round
 * @brief  The match chat as a panel: in the round view's right column or beside the waiting
 *         area, and over the page from a "Chat" button on a phone.
 *
 * Responsibility: on a wide screen the chat sits in the right column under the team tiles
 *                 and takes the column's free height, its list scrolling inside itself, so
 *                 the round view still fits one screen (02 §12). On a phone a "Chat" button
 *                 opens it as a panel over the round, from under the top bar to just above the
 *                 button (which sits above the input row), measured when it opens, so the guess
 *                 field and the button stay in view and usable; the button ("Close chat") or
 *                 Escape closes it again. Between rounds the match page puts the same panel
 *                 under the waiting area, apart from it (T116). The chat stays mounted either
 *                 way, so it keeps its room and what was typed (07 §2).
 * Depends on:     react, @smg/ui (useDisclosure), ./roundChat.css
 * Used by:        ./RoundScreen, ../match/MatchPage
 * Spec:           docs/spec/07-integration.md §2; docs/spec/02-game-guess-the-number.md §12
 */
import { useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { useDisclosure } from '@smg/ui';

import './roundChat.css';

// Where the panel lies on a phone: between the round's top bar (the app's bar outside a
// round) and the Chat button, which sits above the input row, so the button (to close it)
// and the input stay in view.
function overlayBox(button: HTMLElement): CSSProperties {
  const top =
    button.closest('.round-live')?.querySelector('.round-top') ??
    document.querySelector('.shell-bar');
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
