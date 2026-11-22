// @vitest-environment jsdom
/**
 * @file   apps/web/src/lobby/lobby.test.tsx
 * @module web/lobby
 * @brief  The lobby's greeting and its Quick Test link follow the right to open a match.
 *
 * Responsibility: the owner's finding of 2026-11-17: a signed-in player without
 *                 `match.create` is greeted "Welcome, … Join a match below." and sees no Quick
 *                 Test link in a development build; a host is offered to open a match and
 *                 the link. The host's form has "Show on the website" on by default and sends it
 *                 as chosen (O125). The session, the server's lists and the chat are stubbed.
 * Depends on:     vitest, @testing-library/react, ./Lobby
 * Spec:           docs/spec/02-game-guess-the-number.md §2
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Lobby } from './Lobby.js';

const permissions = vi.hoisted(() => ({ list: [] as string[] }));
const sent = vi.hoisted(() => [] as { path: string; body: unknown }[]);
const games = vi.hoisted(() => ({ list: [] as { id: string; name: string }[] }));

vi.mock('../shell/session.js', () => ({
  useSession: () => ({
    session: { account: { displayName: 'Robin' }, authMode: 'local' },
    can: (p: string) => permissions.list.includes(p),
  }),
}));
vi.mock('../shell/http.js', () => ({
  api: (path: string, init?: { body?: unknown }) => {
    if (init?.body !== undefined) sent.push({ path, body: init.body });
    return Promise.resolve({ matches: [], games: [] });
  },
  ApiError: class extends Error {},
}));
vi.mock('../chat/ChatPanel.js', () => ({ ChatPanel: () => null }));
vi.mock('./games.js', () => ({ useGames: () => games.list, gameName: () => '' }));

afterEach(cleanup);

describe('The lobby for a player and for a host', () => {
  it('greets a player without offering to open a match, and shows no Quick Test', async () => {
    permissions.list = ['match.join', 'match.watch', 'chat.send'];
    render(<Lobby dev />);
    expect(await screen.findByText('Welcome, Robin. Join a match below.')).toBeTruthy();
    // The lazy link would have loaded by now for a host (below).
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByTestId('quick-test-link')).toBeNull();
  });

  it('offers a host to open a match, with the Quick Test link', async () => {
    permissions.list = ['match.join', 'match.watch', 'chat.send', 'match.create'];
    render(<Lobby dev />);
    expect(
      await screen.findByText('Welcome, Robin. Join a match below, or open one.'),
    ).toBeTruthy();
    expect((await screen.findByTestId('quick-test-link')).textContent).toBe(
      'Quick Test against bots',
    );
  });

  it('opens a match with "Show on the website" on by default, or off as chosen (O125)', async () => {
    permissions.list = ['match.create'];
    games.list = [{ id: 'safecracker', name: 'Seasonal Safecracker' }];
    render(<Lobby dev />);
    const show = await screen.findByTestId<HTMLInputElement>('show-on-website');
    expect(show.checked).toBe(true);
    fireEvent.change(screen.getByTestId('match-title'), { target: { value: 'Friday' } });
    fireEvent.submit(screen.getByTestId('open-match'));
    fireEvent.click(show);
    fireEvent.submit(screen.getByTestId('open-match'));
    expect(sent.map((r) => (r.body as { showOnWebsite: boolean }).showOnWebsite)).toEqual([
      true,
      false,
    ]);
    games.list = [];
  });
});
