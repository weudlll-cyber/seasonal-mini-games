/**
 * @file   apps/web/src/chat/ChatRoom.tsx
 * @module web/chat
 * @brief  One room of the builtin chat: its messages, the text field, refusals in plain words.
 *
 * Responsibility: the room's messages oldest first, newest at the bottom, in a box that
 *                 scrolls inside itself and follows new messages; each line the author (or a
 *                 system line, or "Message deleted") with its actions (./ModActions: Report,
 *                 and the moderators' actions with chat.moderate); a text field where Enter
 *                 sends, for viewers with chat.send (guests read only); a hint when the room
 *                 is locked or the viewer may not write now; the server's refusal of a message
 *                 in a plain sentence under the field.
 * Depends on:     react, @smg/contracts (views), ../shell/session, ./ModActions, ./useChat
 * Used by:        ./ChatPanel
 * Spec:           docs/spec/07-integration.md §2; Bingo 06 §7, Bingo 03 §12
 */
import type { ChatMessageView, ChatRoomView } from '@smg/contracts';
import { useEffect, useRef, useState, type ReactElement, type SyntheticEvent } from 'react';

import { useSession } from '../shell/session.js';
import { LineActions } from './ModActions.js';
import { useChatRoom, type ChatTarget } from './useChat.js';

function Line(p: {
  readonly message: ChatMessageView;
  readonly me: string | null;
  readonly room: ChatRoomView;
  readonly canReport: boolean;
}): ReactElement {
  const m = p.message;
  if (m.kind === 'system') {
    return <li className="chat-line chat-line--system">{m.text}</li>;
  }
  return (
    <li className="chat-line">
      <strong className="chat-author">{m.author ?? 'Former player'}</strong>{' '}
      {m.text === null ? <em className="smg-muted">Message deleted</em> : <span>{m.text}</span>}
      <LineActions
        message={m}
        canReport={p.canReport && m.author !== p.me}
        canModerate={p.room.canModerate}
      />
    </li>
  );
}

function Writer(p: {
  readonly room: ChatRoomView;
  readonly send: (text: string) => Promise<string | null>;
}): ReactElement {
  const [text, setText] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const submit = (e: SyntheticEvent): void => {
    e.preventDefault();
    const t = text.trim();
    if (t === '') return;
    void p.send(t).then((r) => {
      setRefusal(r);
      if (r === null) setText('');
    });
  };
  const hint = p.room.canSend
    ? null
    : p.room.locked
      ? 'This room is locked. Only moderators can write now.'
      : 'You cannot write here right now.';
  return (
    <div className="chat-writer">
      {hint === null || refusal !== null ? null : <p className="smg-muted">{hint}</p>}
      <form className="chat-form" onSubmit={submit}>
        <input
          className="smg-input"
          aria-label="Message"
          placeholder="Write a message"
          maxLength={300}
          value={text}
          data-testid="chat-input"
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        <button type="submit" className="smg-btn" disabled={text.trim() === ''}>
          Send
        </button>
      </form>
      {refusal === null ? null : (
        <p role="status" className="chat-refusal" data-testid="chat-refusal">
          {refusal}
        </p>
      )}
    </div>
  );
}

export function ChatRoom({ target }: { readonly target: ChatTarget }): ReactElement {
  const { room, messages, problem, send } = useChatRoom(target);
  const { session, can } = useSession();
  const list = useRef<HTMLOListElement>(null);
  // Follow the newest message at the bottom.
  useEffect(() => {
    const el = list.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [messages]);
  if (problem !== null) return <p className="smg-muted">{problem}</p>;
  if (room === null) return <p className="smg-muted">Loading the chat…</p>;
  const writes = can('chat.send');
  const me = session?.account?.displayName ?? null;
  return (
    <>
      <ol ref={list} className="chat-list" data-testid="chat-messages" aria-live="polite">
        {messages.length === 0 ? <li className="smg-muted">No messages yet.</li> : null}
        {messages.map((m) => (
          <Line key={m.id} message={m} me={me} room={room} canReport={writes} />
        ))}
      </ol>
      {writes ? (
        <Writer room={room} send={send} />
      ) : (
        <p className="smg-muted">Sign in to write in the chat.</p>
      )}
    </>
  );
}
