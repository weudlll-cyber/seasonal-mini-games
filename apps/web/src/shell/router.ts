/**
 * @file   apps/web/src/shell/router.ts
 * @module web/shell
 * @brief  Hash routes of the player client: lobby, account, match, boards, profiles, proofs,
 *         and the embedded views.
 *
 * Responsibility: parse `location.hash` into a route and back, and a hook that follows
 *                 hash changes. Hash routing keeps every screen reachable from the dev
 *                 server and from a static host without server rewrites (as Bingo). The
 *                 boards: `#/leaderboard` (optionally `/<periodId>`), a profile
 *                 `#/players/<displayName>` and a round's proof `#/rounds/<roundId>/verify`; inside a
 *                 host page's frame `#/embed/<lobby|match|leaderboard|profile>[/<code or name>]`.
 * Depends on:     react
 * Used by:        ./AppShell, ../account/*, ./DevTools, ../boards/*, ../round/ResultScreen,
 *                 ../embed/*, ../main
 * Spec:           Bingo 01 §13; docs/spec/02-game-guess-the-number.md §9; docs/spec/07-integration.md §1
 */
import { useEffect, useState } from 'react';

export type Route =
  | { readonly name: 'lobby' }
  | { readonly name: 'signIn' }
  | { readonly name: 'register' }
  | { readonly name: 'account' }
  | { readonly name: 'match'; readonly code: string }
  | { readonly name: 'quickTest' }
  | { readonly name: 'leaderboard'; readonly periodId: string | null }
  | { readonly name: 'player'; readonly displayName: string }
  | { readonly name: 'verify'; readonly roundId: string }
  | { readonly name: 'embed'; readonly view: EmbedView; readonly param: string | null };

// The views a host page can embed (07 §1).
type EmbedView = 'lobby' | 'match' | 'leaderboard' | 'profile';
const EMBED_VIEWS: readonly string[] = ['lobby', 'match', 'leaderboard', 'profile'];
const isEmbedView = (v: string | undefined): v is EmbedView =>
  v !== undefined && EMBED_VIEWS.includes(v);

type Rest = readonly (string | undefined)[];

// The first path segment picks the parser; it reads the segments after it, or gives null
// when they do not make a route (then the lobby shows). A Map: no inherited keys.
const PARSERS = new Map<string, (rest: Rest) => Route | null>([
  ['match', ([code]) => (code === undefined ? null : { name: 'match', code })],
  ['quick-test', () => ({ name: 'quickTest' })],
  ['sign-in', () => ({ name: 'signIn' })],
  ['register', () => ({ name: 'register' })],
  ['account', () => ({ name: 'account' })],
  ['leaderboard', ([periodId]) => ({ name: 'leaderboard', periodId: periodId ?? null })],
  ['players', ([n]) => (n === undefined ? null : { name: 'player', displayName: n })],
  [
    'embed',
    ([view, param]) => (isEmbedView(view) ? { name: 'embed', view, param: param ?? null } : null),
  ],
  [
    'rounds',
    ([roundId, what]) =>
      roundId !== undefined && what === 'verify' ? { name: 'verify', roundId } : null,
  ],
]);

export function parseRoute(hash: string): Route {
  let parts: string[];
  try {
    parts = hash
      .replace(/^#\/?/, '')
      .split('/')
      .filter((p) => p.length > 0)
      .map((p) => decodeURIComponent(p));
  } catch {
    // A broken %-escape names no route: the lobby shows, as for any unknown hash.
    return { name: 'lobby' };
  }
  const [first = '', ...rest] = parts;
  return PARSERS.get(first)?.(rest) ?? { name: 'lobby' };
}

// The routes without parameters.
const FIXED: Partial<Record<Route['name'], string>> = {
  lobby: '#/',
  signIn: '#/sign-in',
  register: '#/register',
  account: '#/account',
  quickTest: '#/quick-test',
};

export function hrefOf(route: Route): string {
  switch (route.name) {
    case 'match':
      return `#/match/${encodeURIComponent(route.code)}`;
    case 'leaderboard':
      return route.periodId === null
        ? '#/leaderboard'
        : `#/leaderboard/${encodeURIComponent(route.periodId)}`;
    case 'player':
      return `#/players/${encodeURIComponent(route.displayName)}`;
    case 'verify':
      return `#/rounds/${encodeURIComponent(route.roundId)}/verify`;
    case 'embed':
      return `#/embed/${route.view}${route.param === null ? '' : `/${encodeURIComponent(route.param)}`}`;
    default:
      return FIXED[route.name] ?? '#/';
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
