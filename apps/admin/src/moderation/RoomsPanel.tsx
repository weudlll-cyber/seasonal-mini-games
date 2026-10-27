/**
 * @file   apps/admin/src/moderation/RoomsPanel.tsx
 * @module admin/moderation
 * @brief  A chat room's slow mode and lock, and the word lists of the chat filter.
 *
 * Responsibility: find the lobby room or a match's room by its code (`GET /chat/rooms/lobby`,
 *                 `GET /chat/rooms/match/:code`), change its slow mode and lock (`PATCH
 *                 /admin/chat/rooms/:id`, through the confirm dialog); show and replace the
 *                 block, mask and flag word lists, one term per line (`GET /admin/profanity-
 *                 lists`, `PUT …/:id`).
 * Depends on:     react, @smg/contracts (ChatRoomView), ../ConfirmDialog, ../http, ../TextInput
 * Used by:        ./ModerationPage
 * Spec:           Bingo 11 §3.5; Bingo 03 §12; Bingo 05 §3
 */
import type { ChatRoomView } from '@smg/contracts';
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { useConfirm, type ConfirmRequest } from '../ConfirmDialog.js';
import { api, failureText } from '../http.js';
import { TextInput } from '../TextInput.js';

interface WordList {
  readonly id: string;
  readonly terms: readonly string[];
  readonly updatedAt: number;
}

function roomRequest(room: ChatRoomView, slowModeS: number, locked: boolean): ConfirmRequest {
  const where = room.kind === 'lobby' ? 'the lobby' : `the room of match ${room.matchCode ?? ''}`;
  return {
    title: 'Change the room',
    effect: locked
      ? `Nobody but moderators can write in ${where} until it is unlocked.`
      : `Players write in ${where} at most once every ${String(slowModeS)} seconds (0: no limit).`,
    confirmLabel: 'Apply',
    danger: locked,
    action: () =>
      api(`/admin/chat/rooms/${room.id}`, { method: 'PATCH', body: { slowModeS, locked } }),
  };
}

function RoomSettings(p: {
  readonly room: ChatRoomView;
  readonly open: (r: ConfirmRequest) => void;
}): ReactElement {
  const { room, open } = p;
  const [slow, setSlow] = useState(String(room.slowModeS));
  const [locked, setLocked] = useState(room.locked);
  return (
    <div className="smg-row">
      <TextInput
        label="Slow mode in seconds"
        visible
        value={slow}
        onChange={setSlow}
        maxLength={4}
      />
      <label className="smg-row">
        <input
          type="checkbox"
          checked={locked}
          onChange={(e) => {
            setLocked(e.target.checked);
          }}
        />
        <span>Locked</span>
      </label>
      <button
        type="button"
        className="smg-btn smg-btn--primary"
        disabled={!/^\d{1,4}$/.test(slow)}
        onClick={() => {
          open(roomRequest(room, Number(slow), locked));
        }}
      >
        Apply
      </button>
    </div>
  );
}

function Room({ open }: { readonly open: (r: ConfirmRequest) => void }): ReactElement {
  const [code, setCode] = useState('');
  const [room, setRoom] = useState<ChatRoomView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const find = (): void => {
    const path =
      code.trim() === ''
        ? '/chat/rooms/lobby'
        : `/chat/rooms/match/${encodeURIComponent(code.trim())}`;
    api<ChatRoomView>(path)
      .then((r) => {
        setRoom(r);
        setProblem(null);
      })
      .catch((e: unknown) => {
        setProblem(failureText(e, 'Finding the room'));
      });
  };
  return (
    <div className="smg-stack">
      <h2>Room</h2>
      <div className="smg-row">
        <TextInput
          label="Match code (empty: the lobby)"
          visible
          value={code}
          onChange={setCode}
          maxLength={6}
        />
        <button type="button" className="smg-btn" onClick={find}>
          Find room
        </button>
      </div>
      {problem === null ? null : <p role="alert">{problem}</p>}
      {room === null ? null : <RoomSettings key={room.id} room={room} open={open} />}
    </div>
  );
}

function List({
  list,
  saved,
}: {
  readonly list: WordList;
  readonly saved: () => void;
}): ReactElement {
  const [text, setText] = useState(list.terms.join('\n'));
  const [problem, setProblem] = useState<string | null>(null);
  const save = (): void => {
    const terms = text
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t !== '');
    api(`/admin/profanity-lists/${list.id}`, { method: 'PUT', body: { terms } })
      .then(saved)
      .catch((e: unknown) => {
        setProblem(failureText(e, 'Saving the list'));
      });
  };
  return (
    <label className="smg-field">
      <span>
        {list.id} ({list.terms.length} terms, changed {new Date(list.updatedAt).toLocaleString()})
      </span>
      <textarea
        className="smg-input"
        rows={6}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
      />
      <button type="button" className="smg-btn" onClick={save}>
        Save {list.id} list
      </button>
      {problem === null ? null : <span role="alert">{problem}</span>}
    </label>
  );
}

export function RoomsPanel(): ReactElement {
  const [lists, setLists] = useState<readonly WordList[]>([]);
  const load = useCallback(async () => {
    setLists((await api<{ lists: WordList[] }>('/admin/profanity-lists')).lists);
  }, []);
  const [dialog, open] = useConfirm();
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="smg-panel smg-stack" aria-label="Rooms and word lists">
      <Room open={open} />
      <h2>Word lists</h2>
      {lists.map((l) => (
        <List key={`${l.id}${String(l.updatedAt)}`} list={l} saved={() => void load()} />
      ))}
      {dialog}
    </section>
  );
}
