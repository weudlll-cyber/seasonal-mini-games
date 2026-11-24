// @vitest-environment jsdom
/**
 * @file   apps/web/src/chat/chat.test.tsx
 * @module web/chat
 * @brief  The ChatPanel boundary with its three providers, the builtin room, and the words.
 *
 * Responsibility: in the kit's dock on a phone the room hides its own field while the form
 *                 'field' has one in its bar and the sheet is open (T416 (3)); `none` shows no panel; `hostEmbed` shows the host's room in a sandboxed
 *                 frame; `builtin` shows the room's messages oldest first with system lines and
 *                 deleted messages, sends with Enter (one message at a time, keeping what was
 *                 typed meanwhile) and says a refusal in a plain sentence; a
 *                 moderator's mute asks a confirm sentence and a reason before it calls the
 *                 server; a guest reads without a field; a viewer without any session is asked to
 *                 sign in and the room is not asked for (T370). The refusal and confirm sentences.
 *                 The server and the socket are stand-ins.
 * Depends on:     vitest, @testing-library/react, @smg/contracts (views), ../shell/session,
 *                 ../match/DockedMatch, ../round/fakes, ./ChatPanel, ./chatText
 * Spec:           docs/spec/07-integration.md §2; Bingo 06 §7, Bingo 03 §12
 */
import type { ChatConfigView, ChatMessageView, ChatRoomView } from '@smg/contracts';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../shell/session.js';
import { DockedMatch } from '../match/DockedMatch.js';
import { viewport } from '../round/fakes.js';
import { ChatPanel } from './ChatPanel.js';
import { chatCodeText, confirmText, timeLeft } from './chatText.js';

const intent = vi.fn();
vi.mock('../live/socket.js', () => ({
  gameSocket: () => ({ on: () => undefined, off: () => undefined }),
  intent: (t: string, data: unknown) => intent(t, data) as unknown,
  resetSocket: () => undefined,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  intent.mockReset();
});

const room = (canModerate: boolean): ChatRoomView => ({
  id: 'room-1',
  kind: 'lobby',
  matchCode: null,
  slowModeS: 0,
  locked: false,
  canSend: true,
  canModerate,
});

const MESSAGES: ChatMessageView[] = [
  {
    id: 'm1',
    roomId: 'room-1',
    kind: 'system',
    author: null,
    text: 'Round 1: Walter found it first',
    at: 1,
  },
  { id: 'm2', roomId: 'room-1', kind: 'player', author: 'Walter', text: 'gg', at: 2 },
  { id: 'm3', roomId: 'room-1', kind: 'player', author: 'Mia', text: null, at: 3 },
];

// The server: the session, the chat config and the lobby room; every call is recorded.
function serve(
  config: ChatConfigView,
  permissions: readonly string[],
  moderator = false,
  // The session's kind as the server sends it; null: no session at all.
  kind?: string | null,
  // The room inside the kit's dock on a phone, in this bar form, instead of alone.
  dock?: 'field' | 'line',
) {
  const calls: { url: string; body: unknown }[] = [];
  const session = {
    ...(kind === undefined ? {} : { kind }),
    signedIn: permissions.includes('chat.send'),
    account: permissions.includes('chat.send') ? { id: 'me', displayName: 'Mia' } : null,
    permissions,
    csrfToken: 'x',
  };
  const answers: Record<string, unknown> = {
    '/session': session,
    '/chat/config': config,
    '/chat/rooms/lobby': room(moderator),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: { body?: string }) => {
      const path = url.replace(/^.*\/api\/v1/, '');
      calls.push({ url: path, body: init?.body === undefined ? undefined : JSON.parse(init.body) });
      return Promise.resolve(new Response(JSON.stringify(answers[path] ?? { ok: true })));
    }),
  );
  intent.mockImplementation((t: string) =>
    Promise.resolve(
      t === 'chat.join'
        ? { ok: true, data: { room: room(moderator), messages: MESSAGES } }
        : { ok: false, code: 'CHAT_MUTED', until: Date.now() + 5 * 60_000 },
    ),
  );
  const panel = <ChatPanel target={{ kind: 'lobby' }} bare />;
  render(
    <SessionProvider>
      {dock === undefined ? (
        panel
      ) : (
        <DockedMatch phase="live" chat={panel} bar={dock}>
          <p>The round</p>
        </DockedMatch>
      )}
    </SessionProvider>,
  );
  return calls;
}

describe('the ChatPanel boundary', () => {
  it('shows no panel with the provider none', async () => {
    serve({ provider: 'none', hostChatUrl: null }, ['chat.send']);
    await new Promise((done) => setTimeout(done, 20));
    expect(screen.queryByTestId('chat-panel')).toBeNull();
  });

  it("frames the host's room with hostEmbed", async () => {
    const url = 'https://chat.example/embed/chat?room=mini-games';
    serve({ provider: 'hostEmbed', hostChatUrl: url }, ['chat.send']);
    const frame = await screen.findByTestId('chat-frame');
    // Without <html data-theme> (jsdom) the frame resolves the theme itself (./hostChat.test).
    expect(frame.getAttribute('src')).toBe(`${url}&theme=auto`);
    expect(frame.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-forms allow-popups',
    );
  });
});

describe('the builtin room while a message is on its way', () => {
  it('keeps what was typed while a message was on its way (T102)', async () => {
    serve({ provider: 'builtin', hostChatUrl: null }, ['match.watch', 'chat.send']);
    await screen.findByText('gg');
    let answer: (v: unknown) => void = () => undefined;
    intent.mockImplementation(
      (t: string) =>
        new Promise((resolve) => {
          if (t === 'chat.send') answer = resolve;
        }),
    );
    const field = screen.getByTestId<HTMLInputElement>('chat-input');
    fireEvent.change(field, { target: { value: 'first' } });
    fireEvent.submit(field.closest('form') as HTMLFormElement);
    // The next message is typed before the first one is answered.
    fireEvent.change(field, { target: { value: 'second' } });
    expect(screen.getByText<HTMLButtonElement>('Send').disabled).toBe(true);
    answer({ ok: true });
    await waitFor(() => {
      expect(screen.getByText<HTMLButtonElement>('Send').disabled).toBe(false);
    });
    expect(field.value).toBe('second');
  });
});

describe('the builtin room', () => {
  it('shows the builtin room and words a refused message', async () => {
    serve({ provider: 'builtin', hostChatUrl: null }, ['match.watch', 'chat.send']);
    const list = await screen.findByTestId('chat-messages');
    await screen.findByText('gg');
    expect(list.textContent).toContain('Round 1: Walter found it first');
    expect(list.textContent).toContain('Message deleted');
    // The author is the one-line name, cut with an ellipsis, in full as its title (T202).
    expect(screen.getByText('Walter', { selector: '.chat-author .player-name' }).title).toBe(
      'Walter',
    );
    const text = list.textContent;
    expect(text.indexOf('Round 1')).toBeLessThan(text.indexOf('gg'));
    const field = screen.getByTestId('chat-input');
    fireEvent.change(field, { target: { value: 'hello' } });
    fireEvent.submit(field.closest('form') as HTMLFormElement);
    expect((await screen.findByTestId('chat-refusal')).textContent).toBe(
      'You are muted for 5 min more.',
    );
    expect(intent).toHaveBeenCalledWith('chat.send', { roomId: 'room-1', text: 'hello' });
  });

  it('asks a moderator to confirm a mute with a reason before it calls the server', async () => {
    const calls = serve(
      { provider: 'builtin', hostChatUrl: null },
      ['match.watch', 'chat.send', 'chat.moderate'],
      true,
    );
    await screen.findByText('gg');
    fireEvent.click(screen.getAllByText('Moderate')[0] as HTMLElement);
    fireEvent.click(screen.getByText('Mute 1 h'));
    expect(screen.getByText('Mute Walter in the whole chat for 1 h?')).toBeTruthy();
    const confirm = screen.getByText<HTMLButtonElement>('Confirm');
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'spamming' } });
    fireEvent.click(confirm);
    await screen.findByText('Walter is muted.');
    expect(calls.find((c) => c.url === '/admin/chat/sanctions')?.body).toEqual({
      displayName: 'Walter',
      kind: 'mute',
      scope: 'global',
      minutes: 60,
      reason: 'spamming',
    });
  });

  it('lets a guest read without a field', async () => {
    serve({ provider: 'builtin', hostChatUrl: null }, ['match.watch']);
    await screen.findByText('gg');
    expect(screen.queryByTestId('chat-input')).toBeNull();
    expect(screen.getByText('Sign in to write in the chat.')).toBeTruthy();
    expect(screen.queryByText('Report')).toBeNull();
  });
});

describe('the builtin room without a session (T370)', () => {
  it('asks a viewer without any session to sign in, without asking the server for the room', async () => {
    const calls = serve({ provider: 'builtin', hostChatUrl: null }, [], false, null);
    await screen.findByText('Sign in, or watch as a guest, to read the chat.');
    expect(calls.map((c) => c.url)).not.toContain('/chat/rooms/lobby');
  });

  it('asks the server for the room for a guest', async () => {
    const calls = serve(
      { provider: 'builtin', hostChatUrl: null },
      ['match.watch'],
      false,
      'guest',
    );
    await screen.findByText('gg');
    expect(calls.map((c) => c.url)).toContain('/chat/rooms/lobby');
  });
});

describe("the room's own field in the dock's open sheet (T416 (3))", () => {
  const fields = () => document.querySelectorAll('.chat-writer').length;

  it("hides it while the form 'field' has the field in its bar and the sheet is open", async () => {
    viewport(390, 844);
    serve({ provider: 'builtin', hostChatUrl: null }, ['chat.send'], false, undefined, 'field');
    await screen.findByText('gg', {}, { timeout: 3_000 });
    // Closed: the bar's field and the room's own one inside the closed sheet.
    expect(fields()).toBe(2);
    fireEvent.click(screen.getByTestId('chat-bar'));
    await waitFor(() => {
      expect(fields()).toBe(1);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(fields()).toBe(2);
    });
  });

  it("keeps it in the open sheet of the form 'line', whose bar has none", async () => {
    viewport(390, 844);
    serve({ provider: 'builtin', hostChatUrl: null }, ['chat.send'], false, undefined, 'line');
    await screen.findByText('gg', {}, { timeout: 3_000 });
    expect(fields()).toBe(1);
    fireEvent.click(screen.getByTestId('chat-bar'));
    await waitFor(() => {
      expect(
        screen.getByRole('dialog', { name: 'Chat' }).querySelector('.chat-writer'),
      ).not.toBeNull();
    });
    expect(fields()).toBe(1);
  });
});

describe('the chat sentences', () => {
  it('words every refusal and the time left', () => {
    expect(timeLeft(5_000, 0)).toBe('5 s');
    expect(timeLeft(90_000, 0)).toBe('2 min');
    expect(timeLeft(2 * 3_600_000, 0)).toBe('2 h');
    expect(chatCodeText('CHAT_SLOW_MODE', 8_000, 0)).toBe(
      'Slow mode: wait 8 s before your next message.',
    );
    expect(chatCodeText('CHAT_BANNED')).toBe('You are banned from the chat.');
    expect(chatCodeText('CHAT_FILTERED')).toContain('not allowed');
    expect(chatCodeText('SOMETHING_NEW')).toBe('That did not work. Please try again.');
    expect(confirmText({ kind: 'ban' }, 'Walter')).toContain('Ban Walter');
    expect(confirmText({ kind: 'delete' }, 'Walter')).toBe(
      'Delete this message by Walter for everyone?',
    );
  });
});
