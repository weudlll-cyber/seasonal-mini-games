/**
 * @file   apps/web/src/shell/router.ts
 * @module web/shell
 * @brief  Hash routes of the player client: lobby, sign-in, register, account.
 *
 * Responsibility: parse `location.hash` into a route and back, and a hook that follows
 *                 hash changes, including one between its first render and its listener.
 *                 Hash routing keeps every screen reachable from the dev server and from a
 *                 static host without server rewrites (as Bingo).
 * Depends on:     react
 * Used by:        ./AppShell, ../account/*, ./DevTools
 * Spec:           Bingo 01 §13
 */
import { useEffect, useMemo, useState } from 'react';

export type Route =
  | { readonly name: 'lobby' }
  | { readonly name: 'signIn' }
  | { readonly name: 'register' }
  | { readonly name: 'account' }
  | { readonly name: 'match'; readonly code: string }
  | { readonly name: 'quickTest' };

export function parseRoute(hash: string): Route {
  const [first, second] = hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter((p) => p.length > 0);
  if (first === 'match' && second !== undefined)
    return { name: 'match', code: decodeURIComponent(second) };
  if (first === 'quick-test') return { name: 'quickTest' };
  if (first === 'sign-in') return { name: 'signIn' };
  if (first === 'register') return { name: 'register' };
  if (first === 'account') return { name: 'account' };
  return { name: 'lobby' };
}

export function hrefOf(route: Route): string {
  switch (route.name) {
    case 'lobby':
      return '#/';
    case 'signIn':
      return '#/sign-in';
    case 'register':
      return '#/register';
    case 'account':
      return '#/account';
    case 'match':
      return `#/match/${encodeURIComponent(route.code)}`;
    case 'quickTest':
      return '#/quick-test';
  }
}

export function navigate(route: Route): void {
  window.location.hash = hrefOf(route);
}

export function useRoute(): Route {
  // The hash text, not the parsed route: setting the same text again renders nothing.
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = (): void => {
      setHash(window.location.hash);
    };
    window.addEventListener('hashchange', onChange);
    // A hash set after the first render but before the listener existed fired no event for
    // it (e2e journey 11 in WebKit went to #/quick-test and stayed on the lobby): read it now.
    onChange();
    return () => {
      window.removeEventListener('hashchange', onChange);
    };
  }, []);
  return useMemo(() => parseRoute(hash), [hash]);
}
