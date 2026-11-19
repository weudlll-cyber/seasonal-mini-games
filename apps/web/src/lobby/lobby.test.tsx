// @vitest-environment jsdom
/**
 * @file   apps/web/src/lobby/lobby.test.tsx
 * @module web/lobby
 * @brief  The lobby's greeting and its Quick Test link follow the right to open a match.
 *
 * Responsibility: the owner's finding of 2026-11-17: a signed-in player without
 *                 `match.create` is greeted "Welcome, … Join a match below." and sees no Quick
 *                 Test link in a development build; a host is offered to open a match and
 *                 the link. The session, the server's lists and the chat are stubbed.
 * Depends on:     vitest, @testing-library/react, ./Lobby
 * Spec:           docs/spec/02-game-guess-the-number.md §2
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Lobby } from './Lobby.js';

const permissions = vi.hoisted(() => ({ list: [] as string[] }));

vi.mock('../shell/session.js', () => ({
  useSession: () => ({
    session: { account: { displayName: 'Robin' }, authMode: 'local' },
    can: (p: string) => permissions.list.includes(p),
  }),
}));
vi.mock('../shell/http.js', () => ({
  api: () => Promise.resolve({ matches: [], games: [] }),
  ApiError: class extends Error {},
}));
vi.mock('../chat/ChatPanel.js', () => ({ ChatPanel: () => null }));
vi.mock('./games.js', () => ({ useGames: () => [], gameName: () => '' }));

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
});
