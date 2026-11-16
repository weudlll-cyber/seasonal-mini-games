/**
 * @file   apps/web/src/chat/chatArrivals.ts
 * @module web/chat
 * @brief  React contexts: told of chat messages that arrive while the chat is out of sight.
 *
 * Responsibility: a screen that shows the chat behind a button (the round's focus mode, O46;
 *                 the docked chat's bar on a phone, O97) provides both and shows the count on
 *                 the button's unread badge. `ChatArrivals`: the builtin room (./ChatRoom)
 *                 calls it with each live message by another player, never for its own
 *                 messages, system lines or the history loaded on joining; the screen counts
 *                 those that arrive while its panel is closed, and the docked chat's bar shows
 *                 the newest one's start. `HostChatSight`: a host's embedded chat (`hostEmbed`, the website's
 *                 frame, ./useHostChatFrame) is told whether its panel is in sight and hands
 *                 back the frame's own unread count (DECISIONS T237). `ChatComposerSlot`: the
 *                 builtin room offers its writing part to a screen that writes from elsewhere
 *                 (the docked chat's phone bar, T363).
 * Depends on:     react
 * Used by:        ./ChatRoom, ./useHostChatFrame, ../round/FocusShell, ../match/ChatDock
 * Spec:           docs/spec/07-integration.md §2; Seasonal Entertainment docs/EMBED.md
 */
import type { ChatRoomView } from '@smg/contracts';
import { createContext } from 'react';

// A message that arrived: its author's name and its text (null once a moderator deleted it).
export interface ChatArrival {
  readonly author: string | null;
  readonly text: string | null;
}

export const ChatArrivals = createContext<((message: ChatArrival) => void) | null>(null);

export interface ChatSight {
  // Whether the chat's panel is open (the frame counts unread messages while it is not).
  readonly visible: boolean;
  // The frame's unread count, 0 again once the panel is shown.
  readonly unread: (count: number) => void;
}

export const HostChatSight = createContext<ChatSight | null>(null);

// What a builtin room (./ChatRoom) hands to a screen that shows it from somewhere else, the
// docked chat's phone bar (MG-N8): the room, its newest message of any kind (a system line
// too), and its writing part, null while the viewer cannot write there; nothing until loaded.
export interface ChatComposer {
  readonly room: ChatRoomView;
  readonly newest: ChatArrival | null;
  readonly send: ((text: string) => Promise<string | null>) | null;
}

export const ChatComposerSlot = createContext<((composer: ChatComposer | null) => void) | null>(
  null,
);
