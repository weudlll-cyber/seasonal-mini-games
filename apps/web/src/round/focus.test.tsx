// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/focus.test.tsx
 * @module web/round
 * @brief  The focus mode of a running round (O46): the bar's panels, the unread badge, full screen.
 *
 * Responsibility: the bar shows the time left but no waiting time (O47); Chat, Players and
 *                 Host open as panels from the bar and close with their Close button or
 *                 Escape, the focus moving into the panel itself and back to its button; the
 *                 open panel is named on the round view (its desktop column, O48); only one
 *                 panel is open at a time; the chat panel stays mounted; the unread badge
 *                 counts others' messages while the chat is closed and clears on opening it;
 *                 the full-screen toggle shows only where the Fullscreen API is offered
 *                 (mocked) and follows the browser leaving full screen. The lists are
 *                 ./log.test.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ../chat/chatArrivals, ./fakes,
 *                 ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/09-testing-strategy.md §2
 */
import type { RoundStateView } from '@smg/contracts';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useContext, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatArrivals } from '../chat/chatArrivals.js';
import { ended } from './fakes.js';
import { RoundScreen } from './RoundScreen.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const open: RoundStateView = { ...ended, status: 'open', role: 'player', game: {} };

// A stand-in chat: a field (to see it stays mounted) and a way to make a message arrive.
function FakeChat(): ReactElement {
  const arrived = useContext(ChatArrivals);
  return (
    <div>
      <input aria-label="Message" />
      <button type="button" onClick={() => arrived?.()}>
        A message arrives
      </button>
    </div>
  );
}

function show(host: boolean): void {
  render(
    <RoundScreen
      live={{ state: open, feed: [], reload: () => Promise.resolve() }}
      gameId="none"
      viewerKey="a"
      host={host ? () => <p>The host's controls</p> : null}
      teamPoints={[{ team: 'autumn', points: 3 }]}
      standings={[]}
      chat={<FakeChat />}
    />,
  );
}

const dialog = (name: string) => screen.queryByRole('dialog', { name });

describe('the game bar', () => {
  it('shows the time left but no waiting time (O47)', () => {
    show(false);
    const bar = screen.getByTestId('round-banner').textContent;
    expect(bar).not.toMatch(/Wait/);
    expect(bar).not.toMatch(/\d+ s/);
  });
});

describe('the focus mode panels', () => {
  it('open from the bar and close with Close or Escape, the focus going back', () => {
    show(true);
    const players = screen.getByTestId('focus-players');
    const view = screen.getByTestId('round-view');
    expect(view.dataset['panel']).toBeUndefined();
    fireEvent.click(players);
    expect(dialog('Players')).not.toBeNull();
    // The focus is on the panel itself (its ring only for the keyboard), not its title.
    expect(document.activeElement).toBe(dialog('Players'));
    // The round view names the open panel: on a desktop that is its own column (O48).
    expect(view.dataset['panel']).toBe('players');
    expect(screen.getByTestId('players-panel').textContent).toContain('You');
    expect(screen.getByTestId('team-tiles').textContent).toContain('Team Autumn3');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(dialog('Players')).toBeNull();
    expect(document.activeElement).toBe(players);
    const host = screen.getByTestId('host-menu');
    fireEvent.click(host);
    expect(screen.getByText("The host's controls")).toBeTruthy();
    fireEvent.keyDown(screen.getByText("The host's controls"), { key: 'Escape' });
    expect(dialog('Host')).toBeNull();
    expect(document.activeElement).toBe(host);
  });

  it('show one panel at a time and keep the chat mounted while it is closed', () => {
    show(false);
    expect(screen.queryByTestId('host-menu')).toBeNull();
    fireEvent.click(screen.getByTestId('focus-chat'));
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'gl hf' } });
    fireEvent.click(screen.getByTestId('focus-players'));
    expect(dialog('Players')).not.toBeNull();
    expect(screen.getByTestId('chat-drawer').hidden).toBe(true);
    fireEvent.click(screen.getByTestId('focus-chat'));
    expect(dialog('Players')).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Message').value).toBe('gl hf');
  });

  it('count unread messages while the chat is closed and clear them on opening it', () => {
    show(false);
    const arrive = () => {
      fireEvent.click(screen.getByRole('button', { name: 'A message arrives', hidden: true }));
    };
    expect(screen.queryByTestId('chat-unread')).toBeNull();
    arrive();
    arrive();
    expect(screen.getByTestId('chat-unread').textContent).toBe('2 unread');
    fireEvent.click(screen.getByTestId('focus-chat'));
    expect(screen.queryByTestId('chat-unread')).toBeNull();
    arrive();
    expect(screen.queryByTestId('chat-unread')).toBeNull();
  });
});

describe('the full-screen toggle', () => {
  it('is left out where the browser offers no Fullscreen API', () => {
    show(false);
    expect(screen.queryByTestId('focus-fullscreen')).toBeNull();
  });

  it('asks for full screen on the round view and follows the browser leaving it', () => {
    // jsdom has no Fullscreen API: a browser's, mocked.
    let element: unknown = null;
    const request = vi.fn(() => Promise.resolve());
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    Object.defineProperty(document, 'fullscreenElement', {
      get: () => element,
      configurable: true,
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      value: request,
      configurable: true,
    });
    show(false);
    const toggle = screen.getByTestId('focus-fullscreen');
    fireEvent.click(toggle);
    expect(request).toHaveBeenCalledTimes(1);
    // The element asked to go full screen is the round view itself.
    element = request.mock.contexts[0];
    expect(element).toBe(screen.getByTestId('round-view'));
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    // Left with the browser's own controls (Escape): the toggle follows.
    element = null;
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    for (const key of ['fullscreenEnabled', 'fullscreenElement'])
      Reflect.deleteProperty(document, key);
    Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
  });
});
