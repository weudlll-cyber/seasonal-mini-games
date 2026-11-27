// @vitest-environment jsdom
/**
 * @file   apps/web/src/match/chatDock.test.tsx
 * @module web/match
 * @brief  The docked match chat (O97): mounted once under the round and the result; the phone's
 *         bar with the newest message, the unread count and its own field.
 *
 * Responsibility: the kit's dock (DockedScreen) as the match page uses it. What is typed in
 *                 the docked chat stays when the page switches from the round
 *                 to the result and to the loading line; a desktop shows the chat at once,
 *                 without a bar; a phone shows the bar with "Chat · " and the room's newest
 *                 message and the count of others' messages that arrived while the sheet was
 *                 closed, which opening clears; the sheet's Close and Escape close it and the
 *                 focus returns to the bar; the bar's own field sends without opening the sheet
 *                 (MG-N8). Without a chat (the provider `none`) there is no dock. The list games'
 *                 one-line bar (`bar` 'line', O109): the newest line and the count, no field of
 *                 its own; a tap opens the sheet with the chat and its field; on a desktop the
 *                 same dock as with the field.
 * Depends on:     vitest, @testing-library/react, @seasonal/kit/react (useDockArrivals),
 *                 ../chat/chatArrivals, ../chat/useHostChatFrame, ../round/fakes, ./DockedMatch
 * Spec:           docs/spec/02e-game-mind-games.md §11; docs/spec/02-game-guess-the-number.md §12;
 *                 docs/spec/07-integration.md §2
 */
import { useDockArrivals } from '@seasonal/kit/react';
import type { ChatRoomView } from '@smg/contracts';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useContext, useEffect, useRef, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatComposerSlot } from '../chat/chatArrivals.js';
import { useHostChatFrame } from '../chat/useHostChatFrame.js';
import { viewport } from '../round/fakes.js';
import { DockedMatch } from './DockedMatch.js';

afterEach(() => {
  cleanup();
});

const ROOM: ChatRoomView = {
  id: 'r1',
  kind: 'match',
  matchCode: 'ABC123',
  slowModeS: 0,
  locked: false,
  canSend: true,
  canModerate: false,
};
const sent = vi.fn((_text: string) => Promise.resolve(null));

// A stand-in chat: a field (to see it stays mounted), a way to make a message arrive told to
// the kit's dock, and, as the builtin room does, its writing part offered to the page.
function FakeChat(): ReactElement {
  const dock = useDockArrivals();
  const offer = useContext(ChatComposerSlot);
  useEffect(() => {
    offer?.({ room: ROOM, send: sent });
  }, [offer]);
  const arrive = (): void => {
    dock?.arrived({ author: 'bot-01', text: 'Winter again?' });
  };
  return (
    <div>
      <input aria-label="Draft" />
      <button type="button" onClick={arrive}>
        A message arrives
      </button>
    </div>
  );
}

const page = (
  phase: 'live' | 'loading' | 'after',
  body: string,
  bar: 'field' | 'line' = 'field',
) => (
  <DockedMatch phase={phase} chat={<FakeChat />} bar={bar}>
    <p>{body}</p>
  </DockedMatch>
);

describe('the docked chat', () => {
  it('keeps what was typed from the round to the result and the next round', () => {
    viewport(1280, 720);
    const view = render(page('live', 'The round'));
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'half a sentence' } });
    view.rerender(page('after', 'The result'));
    expect(screen.getByText('The result')).toBeTruthy();
    view.rerender(page('loading', 'Loading the round…'));
    view.rerender(page('live', 'The next round'));
    expect(screen.getByLabelText<HTMLInputElement>('Draft').value).toBe('half a sentence');
    expect(screen.getByTestId('match').getAttribute('data-phase')).toBe('live');
  });

  it('shows the chat itself on a desktop, without a bar', () => {
    viewport(1280, 720);
    render(page('live', 'The round'));
    expect(screen.getByTestId('chat-dock').getAttribute('data-sk-view')).toBe('desktop');
    expect(screen.queryByTestId('chat-bar')).toBeNull();
    expect(screen.getByLabelText('Draft')).toBeTruthy();
  });

  it('gives a phone a bar with the newest message and the unread count, cleared on opening', () => {
    viewport(390, 844);
    render(page('live', 'The round'));
    const bar = screen.getByTestId('chat-bar');
    expect(bar.textContent).toBe('Chat');
    expect(bar.getAttribute('aria-expanded')).toBe('false');
    act(() => {
      screen.getByText('A message arrives', { selector: 'button' }).click();
      screen.getByText('A message arrives', { selector: 'button' }).click();
    });
    expect(bar.textContent).toBe('Chat · bot-01: Winter again?2 unread');
    fireEvent.click(bar);
    expect(bar.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByTestId('chat-unread')).toBeNull();
    // Open, a message is in sight: nothing to count.
    act(() => {
      screen.getByText('A message arrives', { selector: 'button' }).click();
    });
    expect(screen.queryByTestId('chat-unread')).toBeNull();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Chat' }), { key: 'Escape' });
    expect(bar.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(bar);
    fireEvent.click(bar);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(bar.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('a chat whose settings arrive late', () => {
  it('keeps what is above it when the chat arrives after it', () => {
    viewport(390, 844);
    const shown = (chat: ReactElement | null) => (
      <DockedMatch phase="live" chat={chat} bar="line">
        <input aria-label="Above" />
      </DockedMatch>
    );
    const view = render(shown(null));
    fireEvent.change(screen.getByLabelText('Above'), { target: { value: 'still here' } });
    view.rerender(shown(<FakeChat />));
    expect(screen.getByTestId('chat-dock')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Above').value).toBe('still here');
  });
});

// A host chat's frame in the dock (any origin): told whether the sheet is open, its unread count
// going to the phone bar (the kit's useDockSight, T416).
function HostFrame(): ReactElement {
  const frame = useRef<HTMLIFrameElement>(null);
  useHostChatFrame(frame, '/embed/chat?room=mini-games');
  return <iframe ref={frame} title="Chat" data-testid="chat-frame" />;
}

describe('a host chat in the dock (T416)', () => {
  it("is told its sheet's sight and its unread count reaches the phone bar", () => {
    viewport(390, 844);
    render(
      <DockedMatch phase="live" chat={<HostFrame />} bar="line">
        <p>The round</p>
      </DockedMatch>,
    );
    const own = screen.getByTestId<HTMLIFrameElement>('chat-frame').contentWindow;
    if (own === null) throw new Error('no frame window');
    const told = vi.spyOn(own, 'postMessage');
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          source: own,
          data: { source: 'seasonal-chat', type: 'unread', room: 'x', count: 3 },
        }),
      );
    });
    expect(screen.getByTestId('chat-unread').textContent).toBe('3 unread');
    fireEvent.click(screen.getByTestId('chat-bar'));
    expect(told).toHaveBeenLastCalledWith(
      { source: 'seasonal-chat-host', type: 'visible', visible: true },
      window.location.origin,
    );
    expect(screen.queryByTestId('chat-unread')).toBeNull();
  });
});

describe("the docked chat's phone bar (MG-N8)", () => {
  it('sends from its own field without opening the sheet', async () => {
    viewport(390, 844);
    sent.mockClear();
    render(page('after', 'The result'));
    const field = screen.getByPlaceholderText('Write a message…');
    fireEvent.change(field, { target: { value: 'Good round!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(sent).toHaveBeenCalledWith('Good round!');
    });
    expect(screen.getByTestId('chat-bar').getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => {
      expect((field as HTMLInputElement).value).toBe('');
    });
  });

  it('has no dock without a chat', () => {
    viewport(1280, 720);
    render(
      <DockedMatch phase="live" chat={null} bar="field">
        <p>The round</p>
      </DockedMatch>,
    );
    expect(screen.queryByTestId('chat-dock')).toBeNull();
  });
});

describe("the list games' one-line phone bar (O109)", () => {
  it('shows the newest line and the unread count, and no field of its own', () => {
    viewport(390, 844);
    render(page('live', 'The round', 'line'));
    expect(screen.getByTestId('chat-dock').getAttribute('data-sk-bar')).toBe('line');
    act(() => {
      screen.getByText('A message arrives', { selector: 'button' }).click();
    });
    const bar = screen.getByTestId('chat-bar');
    expect(bar.textContent).toBe('Chat · bot-01: Winter again?1 unread');
    // Nothing to write in the bar: the field is the sheet's.
    expect(screen.queryByPlaceholderText('Write a message…')).toBeNull();
    // The sheet stays closed until the bar is tapped.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bar.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the whole chat with its field as a sheet on a tap', () => {
    viewport(390, 844);
    render(page('live', 'The round', 'line'));
    fireEvent.click(screen.getByTestId('chat-bar'));
    const sheet = screen.getByRole('dialog', { name: 'Chat' });
    expect(sheet.hidden).toBe(false);
    // The chat's own field is in the sheet, the bar has none.
    expect(sheet.contains(screen.getByLabelText('Draft'))).toBe(true);
    expect(screen.queryByPlaceholderText('Write a message…')).toBeNull();
    expect(screen.getByTestId('chat-bar').getAttribute('aria-expanded')).toBe('true');
  });

  it('is a dock with the chat itself on a desktop, as the bar with the field is', () => {
    viewport(1440, 900);
    render(page('live', 'The round', 'line'));
    expect(screen.getByTestId('chat-dock').getAttribute('data-sk-view')).toBe('desktop');
    expect(screen.queryByTestId('chat-bar')).toBeNull();
    expect(screen.getByLabelText('Draft')).toBeTruthy();
  });
});
