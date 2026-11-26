/**
 * @file   apps/web/src/shell/AppShell.tsx
 * @module web/shell
 * @brief  The player client's frame: the app header, the screens, the build badge.
 *
 * Responsibility: the kit's `AppHeader` with the game's parts: in website mode the way back to
 *                 the website first ("← Seasonal Entertainment" to /games, GAME-INTEGRATION
 *                 §8), the Seasonal Entertainment emblem with the "Seasonal Mini Games"
 *                 wordmark, the navigation (Play, Leaderboard), the account (the chip
 *                 "<name> (host|player)" to the account page, "Signed in as" shown only on wide
 *                 screens, and Sign out) or, signed out, "Sign in" and "Register", and the
 *                 light/dark toggle at the end; the links and the account fold into one "Menu"
 *                 whenever they do not fit on one row (a phone). Below the bar, the screen of
 *                 the current route. In development also the "Dev sign-in" menu (./DevTools,
 *                 the kit's DevSignIn), loaded on demand so a production build (Vite's DEV
 *                 false) leaves it out; `dev` decides whether it shows. A running round and a
 *                 match's summary hide the header altogether, their focus mode has a bar of its
 *                 own (O46, ../round/focus.css). Website mode (O66): signed out, "Sign in" goes
 *                 to the website's sign-in for the page shown (../account/SignIn
 *                 useSignInHref); no Register, no "Dev sign-in", and the sign-in and register
 *                 addresses show the website's sign-in; a signed-out visitor who opens a match
 *                 watches with a guest session (./session useWatchSession, DECISIONS T221).
 *                 Under the screen, on every page, the build badge (./BuildBadge). Bingo's
 *                 shell, without its game screens.
 * Depends on:     react, @seasonal/kit/react (AppHeader), @seasonal/kit/header.css, ./router,
 *                 ./session, ./BuildBadge, ./DevTools (lazy, development only), ../lobby/Lobby,
 *                 ../account/*, ../match/MatchPage, ../boards/*, ./shell.css,
 *                 assets/brand/emblem.webp
 * Used by:        ../main
 * Spec:           Bingo 01 §13; Bingo 05 §2.1; Seasonal Entertainment docs/GAME-INTEGRATION.md §8
 */
import { AppHeader } from '@seasonal/kit/react';
import { lazy, Suspense, type ReactElement } from 'react';

import emblem from '../../../../assets/brand/emblem.webp';
import { AccountPage } from '../account/AccountPage.js';
import { AccountDeleted } from '../account/DeleteAccount.js';
import { Register } from '../account/Register.js';
import { SignIn, useSignInHref, WebsiteSignIn } from '../account/SignIn.js';
import { LeaderboardPage } from '../boards/LeaderboardPage.js';
import { ProfilePage } from '../boards/ProfilePage.js';
import { VerifyPage } from '../boards/VerifyPage.js';
import { Lobby } from '../lobby/Lobby.js';
import { MatchPage } from '../match/MatchPage.js';
import { BuildBadge } from './BuildBadge.js';
import { hrefOf, useRoute, type Route } from './router.js';
import { useSession, useWatchSession } from './session.js';
import '@seasonal/kit/header.css';
import './shell.css';

// Development tools load on demand. A production build replaces import.meta.env.DEV with
// false, so this import and everything behind it stay out of the bundle.
const DevSignIn = import.meta.env.DEV
  ? lazy(() => import('./DevTools.js').then((m) => ({ default: m.DevSignIn })))
  : null;
const QuickTest = import.meta.env.DEV
  ? lazy(() => import('./QuickTest.js').then((m) => ({ default: m.QuickTest })))
  : null;

type ShellRoute = Exclude<Route, { name: 'embed' }>;

export function AppShell({ dev }: { readonly dev: boolean }): ReactElement {
  const routed = useRoute();
  // An embed address opened after the page loaded shows the lobby: the embed frame exists only
  // for a page opened at it (../main).
  const route: ShellRoute = routed.name === 'embed' ? { name: 'lobby' } : routed;
  return (
    <>
      <Header route={route} dev={dev} />
      <main className="shell-main">
        <Screen route={route} dev={dev} />
      </main>
      <BuildBadge />
    </>
  );
}

// The kit's header with the game's brand, links, account and development menu.
function Header({ route, dev }: { readonly route: ShellRoute; readonly dev: boolean }) {
  const { session, signOut, can } = useSession();
  const website = session?.authMode === 'website';
  const account = session?.account ?? null;
  const signInHref = useSignInHref();
  // The development sign-in does not exist in website mode (07 §7).
  const devTools =
    dev && !website && DevSignIn !== null ? (
      <Suspense fallback={null}>
        <DevSignIn />
      </Suspense>
    ) : undefined;
  return (
    <AppHeader
      websiteMode={website}
      brand={{
        href: hrefOf({ name: 'lobby' }),
        emblem: <img src={emblem} alt="" width="42" height="37" />,
        name: 'Seasonal Mini Games',
      }}
      links={[
        { href: hrefOf({ name: 'lobby' }), label: 'Play', active: route.name === 'lobby' },
        {
          href: hrefOf({ name: 'leaderboard', periodId: null }),
          label: 'Leaderboard',
          active: route.name === 'leaderboard',
        },
      ]}
      account={
        account === null
          ? null
          : {
              name: account.displayName,
              role: can('match.create') ? 'host' : 'player',
              href: hrefOf({ name: 'account' }),
              onSignOut: () => void signOut(),
            }
      }
      signIn={{ href: signInHref, registerHref: hrefOf({ name: 'register' }) }}
      {...(devTools === undefined ? {} : { devTools })}
      // A new route or account closes the folded menu.
      closeKey={`${route.name}|${account?.id ?? 'guest'}`}
      buttonClassName="sk-btn"
    />
  );
}

// Keyed by account: a sign-in as someone else mounts the screen fresh.
function Screen({
  route,
  dev,
}: {
  readonly route: ShellRoute;
  readonly dev: boolean;
}): ReactElement {
  const who = useSession().session?.account?.id ?? 'guest';
  switch (route.name) {
    case 'lobby':
      return <Lobby key={who} dev={dev} />;
    case 'match':
      return <MatchScreen key={`${who}/${route.code}`} code={route.code} />;
    case 'quickTest':
      return dev && QuickTest !== null ? (
        <Suspense fallback={null}>
          <QuickTest />
        </Suspense>
      ) : (
        <Lobby key={who} dev={dev} />
      );
    default:
      return isAccountRoute(route) ? (
        <AccountScreen who={who} route={route} />
      ) : (
        <BoardScreen key={who} route={route} />
      );
  }
}

type AccountRoute = Extract<Route, { name: 'signIn' | 'register' | 'account' | 'accountDeleted' }>;
const ACCOUNT_ROUTES: readonly string[] = ['signIn', 'register', 'account', 'accountDeleted'];
const isAccountRoute = (r: ShellRoute): r is AccountRoute => ACCOUNT_ROUTES.includes(r.name);

// A match, once it can be watched: in website mode a signed-out visitor gets a guest session
// first, so the match socket opens with it (./session useWatchSession).
function MatchScreen({ code }: { readonly code: string }): ReactElement {
  const ready = useWatchSession();
  return ready ? <MatchPage code={code} /> : <p className="smg-muted">Loading the match…</p>;
}

// The account's screens: sign in, register, the own account and the notice after its deletion.
// In website mode the website signs players in and registers them.
function AccountScreen({
  who,
  route,
}: {
  readonly who: string;
  readonly route: AccountRoute;
}): ReactElement {
  const website = useSession().session?.authMode === 'website';
  switch (route.name) {
    case 'signIn':
      return website ? <WebsiteSignIn /> : <SignIn />;
    case 'register':
      return website ? <WebsiteSignIn /> : <Register />;
    case 'account':
      return <AccountPage key={who} />;
    case 'accountDeleted':
      return <AccountDeleted />;
  }
}

// The boards' screens: the leaderboard, a profile, a round's verification page.
function BoardScreen({
  route,
}: {
  readonly route: Extract<Route, { name: 'leaderboard' | 'player' | 'verify' }>;
}): ReactElement {
  switch (route.name) {
    case 'leaderboard':
      return <LeaderboardPage periodId={route.periodId} />;
    case 'player':
      return <ProfilePage key={route.displayName} displayName={route.displayName} />;
    case 'verify':
      return <VerifyPage key={route.roundId} roundId={route.roundId} />;
  }
}
