/**
 * @file   apps/web/src/chat/chatArrivals.ts
 * @module web/chat
 * @brief  Told of chat messages that arrive while the chat is out of sight: the contexts and
 *         the count, on the kit's arrivals.
 *
 * Responsibility: a screen that shows the chat behind a button (the round's focus mode, O46)
 *                 provides both contexts and shows the count on the button's unread badge
 *                 (`useChatArrivals`, the kit's `createChatArrivals` held in React state:
 *                 counted while out of sight, 0 once shown). The docked chat (O97) is the
 *                 kit's dock, which counts with arrivals of its own (../match/DockedMatch). `ChatArrivals`: the builtin room (./ChatRoom) calls it with each live
 *                 message by another player, never for its own messages, system lines or the
 *                 history loaded on joining. `HostChatSight`: a host's embedded chat
 *                 (`hostEmbed`, the website's frame, ./useHostChatFrame) is told whether its
 *                 panel is in sight and hands back the frame's own unread count (DECISIONS
 *                 T237). `ChatComposerSlot`: the builtin room offers its writing part to a
 *                 screen that writes from elsewhere (the docked chat's phone bar field, T363).
 * Depends on:     react, @seasonal/kit (createChatArrivals, ChatArrival), @smg/contracts
 * Used by:        ./ChatRoom, ./useHostChatFrame, ../round/FocusShell, ../match/DockedMatch
 * Spec:           docs/spec/07-integration.md §2; Seasonal Entertainment docs/EMBED.md
 */
import { createChatArrivals, type ChatArrival, type ChatArrivalsState } from '@seasonal/kit';
import type { ChatRoomView } from '@smg/contracts';
import { createContext, useEffect, useMemo, useState } from 'react';

export const ChatArrivals = createContext<((message: ChatArrival) => void) | null>(null);

interface ChatSight {
  // Whether the chat's panel is open (the frame counts unread messages while it is not).
  readonly visible: boolean;
  // The frame's unread count, 0 again once the panel is shown.
  readonly unread: (count: number) => void;
}

export const HostChatSight = createContext<ChatSight | null>(null);

// What a builtin room (./ChatRoom) hands to a screen that writes from somewhere else, the
// docked chat's phone bar (MG-N8): the room and its writing part, null while the viewer cannot
// write there; nothing until loaded.
export interface ChatComposer {
  readonly room: ChatRoomView;
  readonly send: ((text: string) => Promise<string | null>) | null;
}

export const ChatComposerSlot = createContext<((composer: ChatComposer | null) => void) | null>(
  null,
);

// The unread count of a chat shown behind a button: `arrived` for `ChatArrivals`, `sight` for
// `HostChatSight`; cleared whenever the chat comes into sight.
export function useChatArrivals(visible: boolean): {
  readonly unread: number;
  readonly arrived: (message: ChatArrival) => void;
  readonly sight: ChatSight;
} {
  const [state, setState] = useState<ChatArrivalsState>({ unread: 0, newest: null });
  // One counter for the screen's life; it tells the state of every change.
  const [arrivals] = useState(() => createChatArrivals(visible, setState));
  useEffect(() => {
    arrivals.setVisible(visible);
  }, [arrivals, visible]);
  const sight = useMemo(() => ({ visible, unread: arrivals.frameUnread }), [arrivals, visible]);
  return { unread: state.unread, arrived: arrivals.arrived, sight };
}
