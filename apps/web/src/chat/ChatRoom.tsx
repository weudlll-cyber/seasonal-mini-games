/**
 * @file   apps/web/src/chat/ChatRoom.tsx
 * @module web/chat
 * @brief  One room of the builtin chat: its messages, the text field, refusals in plain words.
 *
 * Responsibility: the room's messages oldest first, newest at the bottom, in a box that
 *                 scrolls inside itself and follows new messages; each line the author (one
 *                 line, cut with an ellipsis, ../round/PlayerName) and the text (or a
 *                 system line, or "Message deleted") with its actions (./ModActions: Report,
 *                 and the moderators' actions with chat.moderate); a text field where Enter
 *                 sends, one message at a time, emptied only if it still holds the message
 *                 sent (T102), for viewers with chat.send (guests read only); a hint when the room
 *                 is locked or the viewer may not write now; the server's refusal of a message
 *                 in a plain sentence under the field. Each live message by another player is
 *                 told to the screen around it (./chatArrivals: the round's unread badge; the
 *                 kit's dock, `useDockArrivals`: its bar's count), and the dock is told the
 *                 room's newest line of any kind for its bar; a screen that writes from
 *                 elsewhere gets the room's writing part, which it shows with this file's
 *                 `Writer` (the docked chat's phone bar, T363).
 * Depends on:     react, @seasonal/kit/react (useDockArrivals), @smg/contracts (views),
 *                 ../round/PlayerName, ../shell/session,
 *                 ./chatArrivals, ./ModActions, ./useChat
 * Used by:        ./ChatPanel, ../match/DockedMatch (Writer)
 * Spec:           docs/spec/07-integration.md §2; Bingo 06 §7, Bingo 03 §12
 */
import { useDockArrivals, useDockSight, useDockView } from '@seasonal/kit/react';
import type { ChatMessageView, ChatRoomView } from '@smg/contracts';
import {
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type SyntheticEvent,
} from 'react';

import { PlayerName } from '../round/PlayerName.js';
import { useSession } from '../shell/session.js';
import { ChatArrivals, ChatComposerSlot } from './chatArrivals.js';
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
      <strong className="chat-author">
        <PlayerName name={m.author ?? 'Former player'} />
      </strong>{' '}
      {m.text === null ? <em className="smg-muted">Message deleted</em> : <span>{m.text}</span>}
      <LineActions
        message={m}
        canReport={p.canReport && m.author !== p.me}
        canModerate={p.room.canModerate}
      />
    </li>
  );
}

export function Writer(p: {
  readonly room: ChatRoomView;
  readonly send: (text: string) => Promise<string | null>;
  // The field's placeholder; the room's own is "Write a message".
  readonly placeholder?: string;
}): ReactElement {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const submit = (e: SyntheticEvent): void => {
    e.preventDefault();
    const t = text.trim();
    if (t === '' || sending) return;
    setSending(true);
    void p
      .send(t)
      .then((r) => {
        setRefusal(r);
        // Only the text that was sent goes; what was typed meanwhile stays (T102).
        if (r === null) setText((now) => (now === text ? '' : now));
      })
      .finally(() => {
        setSending(false);
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
          placeholder={p.placeholder ?? 'Write a message'}
          maxLength={300}
          value={text}
          data-testid="chat-input"
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        <button type="submit" className="smg-btn" disabled={text.trim() === '' || sending}>
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
  const { session, can } = useSession();
  const me = session?.account?.displayName ?? null;
  const arrived = useContext(ChatArrivals);
  const dock = useDockArrivals();
  // Unread counts another player's message, never the viewer's own or a system line.
  const { room, messages, problem, send } = useChatRoom(target, (m) => {
    if (m.kind !== 'player' || m.author === me) return;
    arrived?.(m);
    dock?.arrived(m);
  });
  const offer = useContext(ChatComposerSlot);
  const writes = can('chat.send');
  // The dock's bar has the field (the form 'field' gave this room a slot for it) and the sheet is
  // open on a phone: the room's own field would be a second one in the sheet (T416 (3)).
  const sight = useDockSight();
  const phone = useDockView() === 'phone';
  const barHasField = offer !== null && phone && sight?.visible === true;
  // The dock's bar shows the newest line of any kind (a system line too, MG-N8).
  const newest = messages.at(-1) ?? null;
  useEffect(() => {
    if (dock !== null && newest !== null) dock.latest(newest);
  }, [dock, newest]);
  // A screen that writes from elsewhere gets the room's writing part (T363).
  useEffect(() => {
    if (offer === null) return undefined;
    offer(room === null ? null : { room, send: writes ? send : null });
    return () => {
      offer(null);
    };
  }, [offer, room, send, writes]);
  const list = useRef<HTMLOListElement>(null);
  // Follow the newest message at the bottom.
  useEffect(() => {
    const el = list.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [messages]);
  if (problem !== null) return <p className="smg-muted">{problem}</p>;
  if (room === null) return <p className="smg-muted">Loading the chat…</p>;
  return (
    <>
      <ol ref={list} className="chat-list" data-testid="chat-messages" aria-live="polite">
        {messages.length === 0 ? <li className="smg-muted">No messages yet.</li> : null}
        {messages.map((m) => (
          <Line key={m.id} message={m} me={me} room={room} canReport={writes} />
        ))}
      </ol>
      {writes ? (
        barHasField ? null : (
          <Writer room={room} send={send} />
        )
      ) : (
        <p className="smg-muted">Sign in to write in the chat.</p>
      )}
    </>
  );
}
