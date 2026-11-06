/**
 * @file   apps/web/src/chat/useHostChatFrame.ts
 * @module web/chat
 * @brief  React hook: the host page's side of the website chat embed's postMessage protocol.
 *
 * Responsibility: under a screen that shows the chat behind a button (./chatArrivals
 *                 `HostChatSight`), the game is the embed's host page (Seasonal Entertainment
 *                 docs/EMBED.md, "The postMessage API"): it tells the frame
 *                 `{ source: 'seasonal-chat-host', type: 'visible', visible }` whenever the
 *                 panel opens or closes and again on each `ready` (a frame that loaded or
 *                 reloaded has not heard it yet), only to that frame at the chat's origin; it
 *                 hands each `unread` count to the screen's badge. It acts only on messages
 *                 whose `event.origin` is the chat's origin (the frame address's own: this
 *                 site's for the website's room), whose `event.source` is the frame's window
 *                 and whose `source` is `seasonal-chat`; everything else is ignored. Without
 *                 such a screen (the lobby, the waiting area) it posts and listens to nothing.
 *                 Nothing the game posts is secret (DECISIONS T237).
 * Depends on:     react, ./chatArrivals
 * Used by:        ./ChatPanel
 * Spec:           docs/spec/07-integration.md §2; Seasonal Entertainment docs/EMBED.md
 */
import { useContext, useEffect, type RefObject } from 'react';

import { HostChatSight } from './chatArrivals.js';

// A message the chat sends, as EMBED.md defines it: only `ready` and `unread` matter here.
type FromChat = { readonly type: 'ready' } | { readonly type: 'unread'; readonly count: number };

function fromChat(data: unknown): FromChat | null {
  if (typeof data !== 'object' || data === null) return null;
  const m = data as Record<string, unknown>;
  if (m.source !== 'seasonal-chat') return null;
  if (m.type === 'ready') return { type: 'ready' };
  const count = m.count;
  if (m.type !== 'unread' || typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    return null;
  }
  return { type: 'unread', count };
}

export function useHostChatFrame(frame: RefObject<HTMLIFrameElement | null>, url: string): void {
  const sight = useContext(HostChatSight);
  // The chat's origin: the frame address's own (a path is on this site).
  const origin = new URL(url, window.location.origin).origin;
  const visible = sight?.visible;
  const unread = sight?.unread;
  useEffect(() => {
    if (visible === undefined || unread === undefined) return undefined;
    const tell = (): void => {
      const message = { source: 'seasonal-chat-host', type: 'visible', visible };
      frame.current?.contentWindow?.postMessage(message, origin);
    };
    const listen = (event: MessageEvent): void => {
      const own = frame.current?.contentWindow;
      if (event.origin !== origin || own === null || own === undefined) return;
      if (event.source !== own) return;
      const message = fromChat(event.data);
      if (message?.type === 'ready') tell();
      if (message?.type === 'unread') unread(message.count);
    };
    tell();
    window.addEventListener('message', listen);
    return () => {
      window.removeEventListener('message', listen);
    };
  }, [frame, origin, visible, unread]);
}
