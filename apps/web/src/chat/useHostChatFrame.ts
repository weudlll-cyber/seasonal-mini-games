/**
 * @file   apps/web/src/chat/useHostChatFrame.ts
 * @module web/chat
 * @brief  React hook: the host page's side of the website chat embed's postMessage protocol.
 *
 * Responsibility: under a screen that shows the chat behind a button (./chatArrivals
 *                 `HostChatSight`), the game is the embed's host page (Seasonal Entertainment
 *                 docs/EMBED.md, "The postMessage API"), through the kit's checked link
 *                 `connectChat`: it tells the frame whether the panel is in sight, again on
 *                 each `ready`, only at the chat's origin, and hands each `unread` count to the
 *                 screen's badge. The link acts only on messages from the frame's window at
 *                 the chat's origin (the frame address's own: this site's for the website's
 *                 room, another origin's for a host chat elsewhere) and ignores everything
 *                 else. Without such a screen (the lobby, the waiting area) it links nothing.
 *                 Nothing the game posts is secret (DECISIONS T237).
 * Depends on:     react, @seasonal/kit (connectChat), ./chatArrivals
 * Used by:        ./ChatPanel
 * Spec:           docs/spec/07-integration.md §2; Seasonal Entertainment docs/EMBED.md
 */
import { connectChat } from '@seasonal/kit';
import { useContext, useEffect, type RefObject } from 'react';

import { HostChatSight } from './chatArrivals.js';

export function useHostChatFrame(frame: RefObject<HTMLIFrameElement | null>, url: string): void {
  const sight = useContext(HostChatSight);
  // The chat's origin: the frame address's own (a path is on this site).
  const origin = new URL(url, window.location.origin).origin;
  const visible = sight?.visible;
  const unread = sight?.unread;
  useEffect(() => {
    const element = frame.current;
    if (element === null || visible === undefined || unread === undefined) return undefined;
    const link = connectChat({
      frame: element,
      visible,
      origin,
      onMessage: (message) => {
        if (message.type === 'unread') unread(message.count);
      },
    });
    return link.close;
  }, [frame, origin, visible, unread]);
}
