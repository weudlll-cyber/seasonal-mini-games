// @vitest-environment jsdom
/**
 * @file   apps/web/src/match/chatDock.test.tsx
 * @module web/match
 * @brief  The docked match chat (O97): mounted once under the round and the result; the phone's
 *         bar with the newest message and the unread count.
 *
 * Responsibility: what is typed in the docked chat stays when the page switches from the round
 *                 to the result and to the loading line; a desktop shows the chat at once,
 *                 without a bar; a phone shows the bar with the newest message by another
 *                 player and the count of those that arrived while the sheet was closed, which
 *                 opening clears; the sheet's Close and Escape close it and the focus returns to
 *                 the bar. Without a chat (the provider `none`) there is no dock.
 * Depends on:     vitest, @testing-library/react, ../chat/chatArrivals, ../round/fakes,
 *                 ./DockedMatch
 * Spec:           docs/spec/02e-game-mind-games.md §11; docs/spec/07-integration.md §2
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useContext, type ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChatArrivals } from '../chat/chatArrivals.js';
import { viewport } from '../round/fakes.js';
import { DockedMatch } from './DockedMatch.js';

afterEach(() => {
  cleanup();
});

// A stand-in chat: a field (to see it stays mounted) and a way to make a message arrive.
function FakeChat(): ReactElement {
  const arrived = useContext(ChatArrivals);
  return (
    <div>
      <input aria-label="Message" />
      <button type="button" onClick={() => arrived?.({ author: 'bot-01', text: 'Winter again?' })}>
        A message arrives
      </button>
    </div>
  );
}

const page = (phase: 'live' | 'loading' | 'after', body: string) => (
  <DockedMatch phase={phase} chat={<FakeChat />}>
    <p>{body}</p>
  </DockedMatch>
);

describe('the docked chat', () => {
  it('keeps what was typed from the round to the result and the next round', () => {
    viewport(1280, 720);
    const view = render(page('live', 'The round'));
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'half a sentence' } });
    view.rerender(page('after', 'The result'));
    expect(screen.getByText('The result')).toBeTruthy();
    view.rerender(page('loading', 'Loading the round…'));
    view.rerender(page('live', 'The next round'));
    expect(screen.getByLabelText<HTMLInputElement>('Message').value).toBe('half a sentence');
    expect(screen.getByTestId('match').getAttribute('data-phase')).toBe('live');
  });

  it('shows the chat itself on a desktop, without a bar', () => {
    viewport(1280, 720);
    render(page('live', 'The round'));
    expect(screen.getByTestId('chat-dock').getAttribute('data-view')).toBe('desktop');
    expect(screen.queryByTestId('chat-dock-bar')).toBeNull();
    expect(screen.getByLabelText('Message')).toBeTruthy();
  });

  it('gives a phone a bar with the newest message and the unread count, cleared on opening', () => {
    viewport(390, 844);
    render(page('live', 'The round'));
    const bar = screen.getByTestId('chat-dock-bar');
    expect(bar.textContent).toBe('Chat');
    expect(bar.getAttribute('aria-expanded')).toBe('false');
    act(() => {
      screen.getByText('A message arrives', { selector: 'button' }).click();
      screen.getByText('A message arrives', { selector: 'button' }).click();
    });
    expect(bar.textContent).toBe('bot-01: Winter again?2 unread');
    fireEvent.click(bar);
    expect(bar.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByTestId('chat-dock-unread')).toBeNull();
    // Open, a message is in sight: nothing to count.
    act(() => {
      screen.getByText('A message arrives', { selector: 'button' }).click();
    });
    expect(screen.queryByTestId('chat-dock-unread')).toBeNull();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Chat' }), { key: 'Escape' });
    expect(bar.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(bar);
    fireEvent.click(bar);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(bar.getAttribute('aria-expanded')).toBe('false');
  });

  it('has no dock without a chat', () => {
    viewport(1280, 720);
    render(
      <DockedMatch phase="live" chat={null}>
        <p>The round</p>
      </DockedMatch>,
    );
    expect(screen.queryByTestId('chat-dock')).toBeNull();
  });
});
