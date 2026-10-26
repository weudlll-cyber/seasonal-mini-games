/**
 * @file   apps/web/src/shell/router.ts
 * @module web/shell
 * @brief  Hash routes of the player client: lobby, sign-in, register, account.
 *
 * Responsibility: parse `location.hash` into a route and back, and a hook that follows
 *                 hash changes. Hash routing keeps every screen reachable from the dev
 *                 server and from a static host without server rewrites (as Bingo).
 * Depends on:     react
 * Used by:        ./AppShell, ../account/*, ./DevTools
 * Spec:           Bingo 01 §13
 */
import { useEffect, useState } from 'react';

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
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = (): void => {
      setRoute(parseRoute(window.location.hash));
    };
    window.addEventListener('hashchange', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
    };
  }, []);
  return route;
}
