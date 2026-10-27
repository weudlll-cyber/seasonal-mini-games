// @vitest-environment jsdom
/**
 * @file   apps/web/src/shell/shell.test.tsx
 * @module web/shell
 * @brief  The app shell: routes, the dev-only quick sign-in, the role in the account chip.
 *
 * Responsibility: hashes map to the lobby, sign-in, register and account screens and back;
 *                 the quick sign-in buttons "Sign in as host" / "admin" / "player 1/2/3"
 *                 exist only in development (production passes dev=false); the account chip
 *                 says host only with `match.create`; the compact bar's "Menu" opens the
 *                 account block and Escape closes the innermost menu, focus back on its
 *                 button; a late first session answer never undoes a quick sign-in. Taken
 *                 over from Bingo and trimmed.
 * Depends on:     @testing-library/react, ./AppShell, ./router, ./session
 * Spec:           Bingo 05 §2.1; Bingo 01 §13
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell.js';
import { hrefOf, parseRoute } from './router.js';
import { SessionProvider } from './session.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = '';
});

function serve(permissions: readonly string[]): void {
  const session = {
    signedIn: permissions.length > 0,
    account: permissions.length > 0 ? { id: 'a', displayName: 'dev-host' } : null,
    permissions,
    csrfToken: 'x',
  };
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(url.endsWith('/session') ? session : { matches: [], games: [] }),
        ),
      ),
    ),
  );
  // jsdom has no matchMedia; the bar's theme toggle asks it for the system setting.
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

async function renderShell(dev: boolean): Promise<void> {
  render(
    <SessionProvider>
      <AppShell dev={dev} />
    </SessionProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

describe('routes', () => {
  it('maps hashes to screens and back', () => {
    expect(parseRoute('#/')).toEqual({ name: 'lobby' });
    expect(parseRoute('#/sign-in')).toEqual({ name: 'signIn' });
    expect(parseRoute('#/register')).toEqual({ name: 'register' });
    expect(parseRoute('#/account')).toEqual({ name: 'account' });
    expect(parseRoute('#/nowhere')).toEqual({ name: 'lobby' });
    expect(hrefOf({ name: 'account' })).toBe('#/account');
    expect(parseRoute('#/match/ABC234')).toEqual({ name: 'match', code: 'ABC234' });
    expect(hrefOf({ name: 'match', code: 'ABC234' })).toBe('#/match/ABC234');
    expect(parseRoute('#/quick-test')).toEqual({ name: 'quickTest' });
    expect(hrefOf({ name: 'quickTest' })).toBe('#/quick-test');
  });
});

describe('app shell', () => {
  it('offers the quick sign-in only in development', async () => {
    serve([]);
    await renderShell(true);
    // One compact menu in the bar; its items appear when it opens.
    expect(screen.queryByTestId('dev-sign-in-host')).toBeNull();
    // The development tools load on demand (lazy import, left out of production bundles).
    fireEvent.click(await screen.findByTestId('dev-menu'));
    expect(screen.getByTestId('dev-sign-in-host').textContent).toBe('Sign in as host');
    expect(screen.getByTestId('dev-sign-in-admin').textContent).toBe('Sign in as admin');
    expect(screen.getByText(/One window holds one sign-in/)).toBeTruthy();
    expect(screen.getByTestId('dev-sign-in-player-3').textContent).toBe('Sign in as player 3');
    cleanup();
    await renderShell(false);
    expect(screen.queryByTestId('dev-menu')).toBeNull();
  });

  it('opens the compact bar’s menu with its button and closes it with Escape', async () => {
    serve(['match.watch', 'match.join']);
    await renderShell(true);
    // The button shows only in the compact bar (CSS); the account block it opens is the same.
    const button = screen.getByTestId('account-menu');
    const account = screen.getByTestId('account');
    expect(button.getAttribute('aria-controls')).toBe(account.id);
    expect(account.dataset['open']).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(account.dataset['open']).toBe('true');
    // Escape inside the menu closes it, and the focus goes back to the button.
    fireEvent.click(await screen.findByTestId('dev-menu'));
    fireEvent.keyDown(screen.getByTestId('dev-sign-in-host'), { key: 'Escape' });
    expect(screen.queryByTestId('dev-sign-in-host')).toBeNull();
    expect(account.dataset['open']).toBe('true');
    fireEvent.keyDown(screen.getByTestId('signed-in-as'), { key: 'Escape' });
    expect(account.dataset['open']).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('names the host role in the account chip only with match.create', async () => {
    serve(['match.watch', 'match.join', 'match.create', 'match.manage']);
    await renderShell(false);
    expect((await screen.findByTestId('signed-in-as')).textContent).toBe(
      'Signed in as dev-host (host)',
    );
    cleanup();
    serve(['match.watch', 'match.join']);
    await renderShell(false);
    expect((await screen.findByTestId('signed-in-as')).textContent).toBe(
      'Signed in as dev-host (player)',
    );
  });
});

describe('the session after a quick sign-in', () => {
  it('keeps the sign-in when the first session answer arrives after it', async () => {
    const anonymous = { signedIn: false, account: null, permissions: [], csrfToken: 'x' };
    const host = {
      signedIn: true,
      account: { id: 'a', displayName: 'dev-host' },
      permissions: ['match.create'],
      csrfToken: 'y',
    };
    // The first GET /session (sent on load, before the sign-in) answers last.
    let answerFirst: (r: Response) => void = () => undefined;
    let sessionCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (!url.endsWith('/session')) {
          return Promise.resolve(new Response('{"matches":[],"games":[]}'));
        }
        sessionCalls += 1;
        if (sessionCalls === 1) return new Promise<Response>((r) => (answerFirst = r));
        return Promise.resolve(new Response(JSON.stringify(host)));
      }),
    );
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    await renderShell(true);
    fireEvent.click(await screen.findByTestId('dev-menu'));
    fireEvent.click(screen.getByTestId('dev-sign-in-host'));
    expect(await screen.findByTestId('signed-in-as')).toBeTruthy();
    await act(async () => {
      answerFirst(new Response(JSON.stringify(anonymous)));
      await Promise.resolve();
    });
    expect(screen.getByTestId('signed-in-as').textContent).toBe('Signed in as dev-host (host)');
  });
});
