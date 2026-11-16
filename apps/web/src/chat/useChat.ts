/**
 * @file   apps/web/src/chat/useChat.ts
 * @module web/chat
 * @brief  React hooks of the chat: the provider in force, and one builtin room kept live.
 *
 * Responsibility: `useChatConfig` loads GET /chat/config when a screen mounts (null while
 *                 loading; an answer that is no provider counts as `none`). `useChatRoom`
 *                 loads the room as the viewer sees it (the lobby or a match's room), joins it
 *                 over the game socket (`chat.join`, again after every reconnect) for the last
 *                 50 messages, applies the room's `chat` frames (a new message, a deletion, a
 *                 changed lock or slow mode), tells its caller of each message arriving live
 *                 (for an unread count, ./chatArrivals), sends with `chat.send` and leaves when
 *                 the screen goes. After a refusal the room is loaded again, so "may I write"
 *                 stays true. A viewer without any session (not signed in, not a guest) is told
 *                 to sign in without asking the server, which would only answer 401 (the
 *                 lobby's chat opened signed out, T370); while the session loads nothing is
 *                 asked, and once it changes the room is asked again.
 *                 The server decides every refusal; the client only words it.
 * Depends on:     react, @smg/contracts (views), ../shell/http, ../shell/session, ../live/socket,
 *                 ./chatText
 * Used by:        ./ChatPanel, ../match/MatchPage
 * Spec:           docs/spec/07-integration.md §2; Bingo 06 §7
 */
import type { ChatConfigView, ChatEventView, ChatMessageView, ChatRoomView } from '@smg/contracts';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import { gameSocket, intent } from '../live/socket.js';
import { api, ApiError } from '../shell/http.js';
import { useSession } from '../shell/session.js';
import { chatCodeText } from './chatText.js';

const PROVIDERS = new Set(['none', 'builtin', 'hostEmbed']);

export function useChatConfig(): ChatConfigView | null {
  const [config, setConfig] = useState<ChatConfigView | null>(null);
  useEffect(() => {
    let live = true;
    api<ChatConfigView>('/chat/config')
      .then((c) => {
        if (live)
          setConfig(PROVIDERS.has(c.provider) ? c : { provider: 'none', hostChatUrl: null });
      })
      .catch(() => {
        if (live) setConfig({ provider: 'none', hostChatUrl: null });
      });
    return () => {
      live = false;
    };
  }, []);
  return config;
}

export type ChatTarget =
  { readonly kind: 'lobby' } | { readonly kind: 'match'; readonly code: string };

export interface ChatRoomLive {
  readonly room: ChatRoomView | null;
  readonly messages: readonly ChatMessageView[];
  // Why the room cannot be shown (signed out, chat off), or null.
  readonly problem: string | null;
  // Sends a message: null when it went out, else the refusal in plain words.
  readonly send: (text: string) => Promise<string | null>;
}

function apply(list: readonly ChatMessageView[], e: ChatEventView): readonly ChatMessageView[] {
  if (e.type === 'message') {
    return list.some((m) => m.id === e.message.id) ? list : [...list, e.message];
  }
  if (e.type === 'deleted')
    return list.map((m) => (m.id === e.messageId ? { ...m, text: null } : m));
  return list;
}

function roomPath(target: ChatTarget): string {
  return target.kind === 'lobby'
    ? '/chat/rooms/lobby'
    : `/chat/rooms/match/${encodeURIComponent(target.code)}`;
}

// Joins the room over the socket (again after a reconnect) and applies its frames; `onLive`
// hears of each message that arrives live (not the history the join loads).
function useRoomFrames(
  roomId: string | null,
  setRoom: Dispatch<SetStateAction<ChatRoomView | null>>,
  setMessages: Dispatch<SetStateAction<readonly ChatMessageView[]>>,
  onLive: (m: ChatMessageView) => void,
): void {
  // The newest callback, without joining the room again when it changes.
  const live = useRef(onLive);
  useEffect(() => {
    live.current = onLive;
  });
  useEffect(() => {
    if (roomId === null) return;
    const socket = gameSocket();
    const join = (): void => {
      void intent('chat.join', { roomId }).then((a) => {
        const data = a.data as { room: ChatRoomView; messages: ChatMessageView[] } | undefined;
        if (!a.ok || data === undefined) return;
        setRoom(data.room);
        setMessages(data.messages);
      });
    };
    const onChat = (e: ChatEventView): void => {
      const about =
        e.type === 'message' ? e.message.roomId : e.type === 'deleted' ? e.roomId : e.room.id;
      if (about !== roomId) return;
      if (e.type === 'room') setRoom((r) => (r === null ? r : { ...r, ...e.room }));
      else setMessages((list) => apply(list, e));
      if (e.type === 'message') live.current(e.message);
    };
    join();
    socket.on('connect', join);
    socket.on('chat', onChat);
    return () => {
      socket.off('connect', join);
      socket.off('chat', onChat);
      void intent('chat.leave', { roomId });
    };
  }, [roomId]);
}

const nobody = (): void => undefined;

const SIGN_IN = 'Sign in, or watch as a guest, to read the chat.';

export function useChatRoom(
  target: ChatTarget,
  onLive: (m: ChatMessageView) => void = nobody,
): ChatRoomLive {
  const path = roomPath(target);
  const [room, setRoom] = useState<ChatRoomView | null>(null);
  const [messages, setMessages] = useState<readonly ChatMessageView[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  // Whether the viewer's session has loaded, and whether there is none at all (T370).
  const { session } = useSession();
  const known = session !== null;
  const none = session?.kind === null;
  const load = useCallback(async () => {
    try {
      setRoom(await api<ChatRoomView>(path));
      setProblem(null);
    } catch (error) {
      const signedOut = error instanceof ApiError && error.status === 401;
      setProblem(signedOut ? SIGN_IN : 'The chat is not available.');
    }
  }, [path]);
  useEffect(() => {
    if (!known) return;
    // No session at all: the server would only answer 401, so ask nothing.
    if (none) {
      setRoom(null);
      setProblem(SIGN_IN);
      return;
    }
    void load();
  }, [load, known, none]);
  const roomId = room?.id ?? null;
  useRoomFrames(roomId, setRoom, setMessages, onLive);
  const send = useCallback(
    async (text: string): Promise<string | null> => {
      if (roomId === null) return chatCodeText(undefined);
      const answer = await intent('chat.send', { roomId, text });
      const sent = (answer.data as { message?: ChatMessageView } | undefined)?.message;
      if (answer.ok && sent !== undefined) {
        setMessages((list) => apply(list, { type: 'message', message: sent }));
        return null;
      }
      void load();
      return chatCodeText(answer.code, answer.until);
    },
    [roomId, load],
  );
  return { room, messages, problem, send };
}
