/**
 * @file   apps/web/src/chat/chatArrivals.ts
 * @module web/chat
 * @brief  React contexts: told of chat messages that arrive while the chat is out of sight.
 *
 * Responsibility: a screen that shows the chat behind a button (the round's focus mode, O46)
 *                 provides both and shows the count on the Chat button's unread badge.
 *                 `ChatArrivals`: the builtin room (./ChatRoom) calls it for each live message
 *                 by another player, never for its own messages, system lines or the history
 *                 loaded on joining; the screen counts those that arrive while its panel is
 *                 closed. `HostChatSight`: a host's embedded chat (`hostEmbed`, the website's
 *                 frame, ./useHostChatFrame) is told whether its panel is in sight and hands
 *                 back the frame's own unread count (DECISIONS T237).
 * Depends on:     react
 * Used by:        ./ChatRoom, ./useHostChatFrame, ../round/FocusShell
 * Spec:           docs/spec/07-integration.md §2; Seasonal Entertainment docs/EMBED.md
 */
import { createContext } from 'react';

export const ChatArrivals = createContext<(() => void) | null>(null);

export interface ChatSight {
  // Whether the chat's panel is open (the frame counts unread messages while it is not).
  readonly visible: boolean;
  // The frame's unread count, 0 again once the panel is shown.
  readonly unread: (count: number) => void;
}

export const HostChatSight = createContext<ChatSight | null>(null);
