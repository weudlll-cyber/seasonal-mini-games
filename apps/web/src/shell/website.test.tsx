// @vitest-environment jsdom
/**
 * @file   apps/web/src/shell/website.test.tsx
 * @module web/shell
 * @brief  Website mode in the shell (O66): sign-in through the website, no local forms, guest watchers.
 *
 * Responsibility: signed out in website mode, "Sign in" (bar and lobby) goes to the sign-in
 *                 route with the page shown as `next`; there is no Register, no "Dev sign-in"
 *                 (even in development), and the sign-in and register addresses show only the
 *                 website's sign-in; a signed-out visitor who opens a match gets a guest session
 *                 (POST /auth/guest) before the match is watched. Local mode keeps Register,
 *                 the form and the dev sign-in, and starts no guest session.
 * Depends on:     vitest, @testing-library/react, ./AppShell, ./session
 * Spec:           docs/spec/07-integration.md §7; DECISIONS T221, T238
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell.js';
import { SessionProvider } from './session.js';

const intent = vi.fn((_t: string, _data: unknown) => Promise.resolve({ ok: true }));
vi.mock('../live/socket.js', () => ({
  gameSocket: () => ({ on: () => undefined, off: () => undefined }),
  intent: (t: string, data: unknown) => intent(t, data) as unknown,
  resetSocket: () => undefined,
  serverNow: () => Date.now(),
}));

const SIGN_IN = '/games/mini-games/auth/website';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  intent.mockClear();
  window.location.hash = '';
});

// The server: no session until POST /auth/guest starts a guest's; every call in order.
function serve(authMode: 'website' | 'local'): string[] {
  const calls: string[] = [];
  let guest = false;
  const session = () => ({
    signedIn: false,
    kind: guest ? 'guest' : null,
    account: null,
    permissions: guest ? ['match.watch'] : [],
    csrfToken: null,
    authMode,
    signInPath: authMode === 'website' ? SIGN_IN : null,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: { method?: string }) => {
      const path = url.replace(/^.*\/api\/v1/, '');
      calls.push(`${init?.method ?? 'GET'} ${path}`);
      if (path === '/auth/guest') guest = true;
      // The match is not found: its page still asks to watch it first (../live/useMatch).
      if (path.startsWith('/matches/')) {
        return Promise.resolve(new Response('{"code":"NOT_FOUND"}', { status: 404 }));
      }
      const body = path === '/session' ? session() : { matches: [], games: [] };
      return Promise.resolve(new Response(JSON.stringify(body)));
    }),
  );
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  intent.mockImplementation(() => {
    calls.push('intent');
    return Promise.resolve({ ok: true });
  });
  return calls;
}

async function renderShell(dev: boolean): Promise<void> {
  render(
    <SessionProvider>
      <AppShell dev={dev} />
    </SessionProvider>,
  );
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const nextOf = (hash: string) =>
  `${SIGN_IN}?next=${encodeURIComponent(`${window.location.pathname}${hash}`)}`;

describe('website mode, signed out', () => {
  it('signs in through the website for this page, with no Register and no dev sign-in', async () => {
    serve('website');
    window.location.hash = '#/leaderboard';
    await renderShell(true);
    expect(screen.getByTestId('open-sign-in').getAttribute('href')).toBe(nextOf('#/leaderboard'));
    expect(screen.queryByTestId('open-register')).toBeNull();
    expect(screen.queryByTestId('dev-menu')).toBeNull();
  });

  it('shows the website sign-in at the sign-in and register addresses, and in the lobby', async () => {
    serve('website');
    window.location.hash = '#/sign-in';
    await renderShell(false);
    expect(screen.getByTestId('website-sign-in')).toBeTruthy();
    expect(screen.queryByTestId('sign-in-form')).toBeNull();
    cleanup();
    window.location.hash = '#/register';
    await renderShell(false);
    expect(screen.getByTestId('website-sign-in')).toBeTruthy();
    cleanup();
    window.location.hash = '#/';
    await renderShell(false);
    const lobby = screen.getByTestId('lobby');
    expect(lobby.querySelector('a[href="#/register"]')).toBeNull();
    expect(lobby.querySelector(`a[href="${nextOf('#/')}"]`)?.textContent).toBe('Sign in');
  });

  it('watches a match with a guest session started first', async () => {
    const calls = serve('website');
    window.location.hash = '#/match/ABC234';
    await renderShell(false);
    const guest = calls.indexOf('POST /auth/guest');
    expect(guest).toBeGreaterThan(-1);
    expect(calls.indexOf('intent')).toBeGreaterThan(guest);
  });
});

describe('local mode', () => {
  it('keeps Register, the form and the dev sign-in, and starts no guest session', async () => {
    const calls = serve('local');
    window.location.hash = '#/match/ABC234';
    await renderShell(true);
    expect(screen.getByTestId('open-sign-in').getAttribute('href')).toBe('#/sign-in');
    expect(screen.getByTestId('open-register')).toBeTruthy();
    expect(await screen.findByTestId('dev-menu')).toBeTruthy();
    expect(calls).not.toContain('POST /auth/guest');
    expect(calls).toContain('intent');
    cleanup();
    window.location.hash = '#/sign-in';
    await renderShell(false);
    expect(screen.getByTestId('sign-in-form')).toBeTruthy();
  });
});
