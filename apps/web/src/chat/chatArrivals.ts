/**
 * @file   apps/web/src/chat/chatArrivals.ts
 * @module web/chat
 * @brief  React context: told of every chat message that arrives live from someone else.
 *
 * Responsibility: a screen that shows the chat behind a button (the round's focus mode, O46)
 *                 provides a callback here and counts the messages that arrive while its panel
 *                 is closed, for the Chat button's unread badge; the builtin room
 *                 (./ChatRoom) calls it for each live message by another player, never for its
 *                 own messages, system lines or the history loaded on joining. A host's
 *                 embedded chat (an iframe, `hostEmbed`) tells nothing, so it shows no count.
 * Depends on:     react
 * Used by:        ./ChatRoom, ../round/FocusShell
 * Spec:           docs/spec/07-integration.md §2
 */
import { createContext } from 'react';

export const ChatArrivals = createContext<(() => void) | null>(null);
