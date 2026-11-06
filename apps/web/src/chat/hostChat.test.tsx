// @vitest-environment jsdom
/**
 * @file   apps/web/src/chat/hostChat.test.tsx
 * @module web/chat
 * @brief  The website's chat in the panel (hostEmbed, O66): its frame, theme, "Log in" and badge.
 *
 * Responsibility: the panel frames `/embed/chat?room=mini-games` with `theme` following the
 *                 page's light/dark theme, also after a switch, under the title "Chat"; a
 *                 visitor who is not signed in gets "Log in" to the website's sign-in for this
 *                 page in website mode, a member none, and local mode none. Behind the round
 *                 bar's Chat button the frame is told `visible` false or true as the panel
 *                 closes or opens (again on `ready`), and its `unread` count shows on the
 *                 badge, only from the frame's own window at the chat's origin with `source`
 *                 `seasonal-chat` (DECISIONS T237); the frame asks for an origin-only
 *                 referrer (T242).
 * Depends on:     vitest, @testing-library/react, @smg/contracts (views), ../shell/session,
 *                 ../round/fakes, ../round/RoundScreen, ./ChatPanel
 * Spec:           docs/spec/07-integration.md §2; Seasonal Entertainment docs/EMBED.md
 */
import type { ChatConfigView, RoundStateView } from '@smg/contracts';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ended } from '../round/fakes.js';
import { RoundScreen } from '../round/RoundScreen.js';
import { SessionProvider } from '../shell/session.js';
import { ChatPanel } from './ChatPanel.js';

vi.mock('../live/socket.js', () => ({ resetSocket: () => undefined, serverNow: () => Date.now() }));

const WEBSITE_CHAT: ChatConfigView = {
  provider: 'hostEmbed',
  hostChatUrl: '/embed/chat?room=mini-games',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
  window.location.hash = '';
});

// The session the server answers: signed in or not, in website or local mode.
function serve(member: boolean, authMode: 'website' | 'local' = 'website'): void {
  const session = {
    signedIn: member,
    kind: member ? 'player' : 'guest',
    account: member ? { id: 'a', displayName: 'Mia', hasPassword: false } : null,
    permissions: member ? ['match.watch', 'chat.send'] : ['match.watch'],
    csrfToken: 'x',
    authMode,
    signInPath: authMode === 'website' ? '/games/mini-games/auth/website' : null,
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(session)))),
  );
}

async function show(): Promise<void> {
  render(
    <SessionProvider>
      <ChatPanel target={{ kind: 'match', code: 'ABC234' }} config={WEBSITE_CHAT} bare />
    </SessionProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

describe("the website's chat in the panel", () => {
  it('frames /embed/chat with the theme the page shows, also after a switch', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    serve(true);
    await show();
    const frame = screen.getByTitle('Chat');
    expect(frame.getAttribute('src')).toBe('/embed/chat?room=mini-games&theme=dark');
    act(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(frame.getAttribute('src')).toBe('/embed/chat?room=mini-games&theme=light');
  });
});

describe('"Log in" for guests', () => {
  it('offers a guest "Log in" through the website for this page; a member gets none', async () => {
    window.location.hash = '#/match/ABC234';
    serve(false);
    await show();
    const link = await screen.findByRole('link', { name: 'Log in' });
    const page = `${window.location.pathname}#/match/ABC234`;
    expect(link.getAttribute('href')).toBe(
      `/games/mini-games/auth/website?next=${encodeURIComponent(page)}`,
    );
    expect(link.getAttribute('data-testid')).toBe('chat-log-in');
    cleanup();
    serve(true);
    await show();
    expect(screen.getByTestId('chat-frame')).toBeTruthy();
    expect(screen.queryByTestId('chat-log-in')).toBeNull();
  });

  it('shows no "Log in" in local mode', async () => {
    serve(false, 'local');
    await show();
    expect(screen.getByTestId('chat-frame')).toBeTruthy();
    expect(screen.queryByTestId('chat-log-in')).toBeNull();
  });
});

// The round bar with the website's chat behind its Chat button; the chat frame's window.
function roundWithChat(): Window {
  serve(true);
  const open: RoundStateView = { ...ended, status: 'open', role: 'player', game: {} };
  render(
    <SessionProvider>
      <RoundScreen
        live={{ state: open, feed: [], reload: () => Promise.resolve() }}
        gameId="none"
        viewerKey="a"
        host={null}
        teamPoints={[]}
        standings={[]}
        chat={<ChatPanel target={{ kind: 'match', code: 'ABC234' }} config={WEBSITE_CHAT} bare />}
      />
    </SessionProvider>,
  );
  const own = screen.getByTestId<HTMLIFrameElement>('chat-frame').contentWindow;
  if (own === null) throw new Error('no frame window');
  return own;
}

// A message as the chat frame (or a stranger) posts it to the game's page.
function post(data: object, from: { origin?: string; source?: Window | null } = {}): void {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: from.origin ?? window.location.origin,
        source: from.source ?? null,
        data,
      }),
    );
  });
}

const unread = (count: number) => ({ source: 'seasonal-chat', type: 'unread', room: 'x', count });
const visible = (shown: boolean) => ({
  source: 'seasonal-chat-host',
  type: 'visible',
  visible: shown,
});

describe("the website chat's unread badge (T237)", () => {
  it('tells the frame its panel is hidden or shown and shows its count on the badge', () => {
    const own = roundWithChat();
    const told = vi.spyOn(own, 'postMessage');
    post(
      { source: 'seasonal-chat', type: 'ready', room: 'mini-games', signedIn: true },
      { source: own },
    );
    expect(told).toHaveBeenLastCalledWith(visible(false), window.location.origin);
    post(unread(3), { source: own });
    expect(screen.getByTestId('chat-unread').textContent).toBe('3 unread');
    act(() => {
      screen.getByTestId('focus-chat').click();
    });
    expect(told).toHaveBeenLastCalledWith(visible(true), window.location.origin);
    expect(screen.queryByTestId('chat-unread')).toBeNull();
  });

  it('ignores another origin, another window, another source and a malformed count', () => {
    const own = roundWithChat();
    post(unread(2), { origin: 'https://evil.example', source: own });
    post(unread(2), { source: window });
    post(unread(2));
    post({ ...unread(2), source: 'seasonal-chat-host' }, { source: own });
    post(unread(-1), { source: own });
    post({ ...unread(2), count: '2' }, { source: own });
    expect(screen.queryByTestId('chat-unread')).toBeNull();
  });

  it('asks the browser for a referrer with the origin only', () => {
    roundWithChat();
    expect(screen.getByTestId('chat-frame').getAttribute('referrerpolicy')).toBe('strict-origin');
  });
});
