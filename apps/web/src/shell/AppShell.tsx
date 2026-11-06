/**
 * @file   apps/web/src/shell/AppShell.tsx
 * @module web/shell
 * @brief  The player client's frame: top bar, navigation, account, screens.
 *
 * Responsibility: show the Seasonal Entertainment emblem with the "Seasonal Mini Games"
 *                 wordmark, the light/dark toggle, the navigation and the account
 *                 ("Signed in as <name> (host|player)", Account, Sign out) or, signed out,
 *                 "Sign in" and "Register". Below the bar, the screen of the current route.
 *                 In development also the "Dev sign-in" menu (./DevTools), loaded on demand so
 *                 a production build (Vite's DEV false) leaves it out; `dev` decides whether
 *                 it shows. On a one-screen view on a phone (a match's summary) the bar is one
 *                 compact row and the account and development controls sit behind one "Menu"
 *                 button (./shell.css); a running round hides the bar altogether, its focus
 *                 mode has a bar of its own (O46). The navigation has Play and Leaderboard;
 *                 the compact bar keeps Play only.
 *                 Website mode (O66): signed out, "Sign in" goes to the website's sign-in for
 *                 the page shown (../account/SignIn SignInLink); no Register, no "Dev sign-in",
 *                 and the sign-in and register addresses show the website's sign-in; a
 *                 signed-out visitor who opens a match watches with a guest session
 *                 (./session useWatchSession, DECISIONS T221).
 *                 Bingo's shell, without its game screens.
 * Depends on:     react, ./router, ./session, ./ThemeToggle, ./DevTools (lazy, development
 *                 only), @smg/ui (useDisclosure), ../lobby/Lobby, ../account/*,
 *                 ../match/MatchPage, ../boards/*, ./shell.css, assets/brand/emblem.webp
 * Used by:        ../main
 * Spec:           Bingo 01 §13; Bingo 05 §2.1
 */
import { lazy, Suspense, type ReactElement } from 'react';
import { useDisclosure } from '@smg/ui';

import emblem from '../../../../assets/brand/emblem.webp';
import { AccountPage } from '../account/AccountPage.js';
import { AccountDeleted } from '../account/DeleteAccount.js';
import { Register } from '../account/Register.js';
import { SignIn, SignInLink, WebsiteSignIn } from '../account/SignIn.js';
import { LeaderboardPage } from '../boards/LeaderboardPage.js';
import { ProfilePage } from '../boards/ProfilePage.js';
import { VerifyPage } from '../boards/VerifyPage.js';
import { Lobby } from '../lobby/Lobby.js';
import { MatchPage } from '../match/MatchPage.js';
import { hrefOf, useRoute, type Route } from './router.js';
import { useSession, useWatchSession } from './session.js';
import { ThemeToggle } from './ThemeToggle.js';
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
  // Keyed by account: a sign-in or sign-out from the menu closes it.
  const who = useSession().session?.account?.id ?? 'guest';
  return (
    <>
      <header className="shell-bar">
        <a className="shell-brand" href={hrefOf({ name: 'lobby' })}>
          <img src={emblem} alt="" width="42" height="37" />
          <span>
            Seasonal Mini Games
            <small>Seasonal Entertainment</small>
          </span>
        </a>
        {/* Beside the account on wide screens, beside the brand on phones (shell.css). */}
        <ThemeToggle />
        <Nav route={route} />
        <Account key={who} dev={dev} />
      </header>
      <main className="shell-main">
        <Screen route={route} dev={dev} />
      </main>
    </>
  );
}

function Nav({ route }: { readonly route: Route }): ReactElement {
  return (
    <nav className="shell-nav" aria-label="Main">
      <a
        href={hrefOf({ name: 'lobby' })}
        aria-current={route.name === 'lobby' ? 'page' : undefined}
      >
        Play
      </a>
      {/* Left out of the compact bar of a running round on a phone (shell.css). */}
      <a
        className="shell-nav-boards"
        href={hrefOf({ name: 'leaderboard', periodId: null })}
        aria-current={route.name === 'leaderboard' ? 'page' : undefined}
      >
        Leaderboard
      </a>
    </nav>
  );
}

// The account and the development menu: in the bar, or, in the compact bar of a round on a
// phone (shell.css), behind one "Menu" button that the wide bar hides.
function Account({ dev }: { readonly dev: boolean }): ReactElement {
  const menu = useDisclosure();
  return (
    <div className="shell-menu" onKeyDown={menu.onKeyDown}>
      <button
        ref={menu.button}
        type="button"
        className="smg-btn shell-menu-button"
        aria-expanded={menu.open}
        aria-controls={menu.panelId}
        data-testid="account-menu"
        onClick={menu.toggle}
      >
        Menu
      </button>
      <AccountItems id={menu.panelId} open={menu.open} dev={dev} />
    </div>
  );
}

function AccountItems(props: {
  readonly id: string;
  readonly open: boolean;
  readonly dev: boolean;
}): ReactElement {
  const { session, signOut, can } = useSession();
  const website = session?.authMode === 'website';
  // The development sign-in does not exist in website mode (07 §7).
  const dev = props.dev && !website;
  return (
    <div id={props.id} className="shell-account" data-open={props.open} data-testid="account">
      {session?.account ? (
        <>
          <a className="smg-chip" href={hrefOf({ name: 'account' })} data-testid="signed-in-as">
            <span className="chip-prefix">Signed in as </span>
            {session.account.displayName} ({can('match.create') ? 'host' : 'player'})
          </a>
          <button
            type="button"
            className="smg-btn"
            data-testid="sign-out"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </>
      ) : null}
      {session !== null && session.account === null ? (
        <>
          <SignInLink className="smg-btn smg-btn--primary" testId="open-sign-in">
            Sign in
          </SignInLink>
          {website ? null : (
            <a className="smg-btn" href={hrefOf({ name: 'register' })} data-testid="open-register">
              Register
            </a>
          )}
        </>
      ) : null}
      {dev && DevSignIn !== null ? (
        <Suspense fallback={null}>
          <DevSignIn />
        </Suspense>
      ) : null}
    </div>
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
