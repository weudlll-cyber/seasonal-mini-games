/**
 * @file   apps/web/src/embed/EmbedShell.tsx
 * @module web/embed
 * @brief  The player client inside a host page's frame: one view, no top bar.
 *
 * Responsibility: show the embedded view (lobby, a match with its running round, the season
 *                 board, a profile) with the signed-in player's name once the host page is known
 *                 to be on the allowlist, and a short refusal on any other page; a match opened
 *                 from the embedded lobby shows in the frame too. The host handshake is ./embedHost.
 * Depends on:     react, ../shell/*, ../lobby/Lobby, ../match/MatchPage, ../boards/*, ./embedHost,
 *                 ./embed.css
 * Used by:        ../main
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §3.1–§3.3
 */
import type { ReactElement } from 'react';

import { LeaderboardPage } from '../boards/LeaderboardPage.js';
import { ProfilePage } from '../boards/ProfilePage.js';
import { Lobby } from '../lobby/Lobby.js';
import { MatchPage } from '../match/MatchPage.js';
import { useRoute, type Route } from '../shell/router.js';
import { useSession } from '../shell/session.js';
import { useEmbedHost } from './embedHost.js';
import './embed.css';

type EmbedRoute = Extract<Route, { name: 'embed' }>;

export function EmbedShell({ first }: { readonly first: EmbedRoute }): ReactElement | null {
  const route = useRoute();
  const shown = route.name === 'embed' || route.name === 'match' ? route : first;
  const watching = shown.name === 'match' || shown.view === 'match';
  const state = useEmbedHost(first.view, watching);
  if (state === 'checking') return null;
  if (state === 'refused') {
    return (
      <p className="embed-refused" data-testid="embed-refused">
        This site may not show Seasonal Mini Games.
      </p>
    );
  }
  return (
    <main className="embed-main" data-testid="embed">
      <SignedIn />
      <View route={shown} />
    </main>
  );
}

// Who plays here: the host's sign-in carried over (single sign-on), or nobody yet.
function SignedIn(): ReactElement | null {
  const account = useSession().session?.account ?? null;
  if (account === null) return null;
  return (
    <p className="embed-who" data-testid="embed-signed-in">
      Signed in as {account.displayName}
    </p>
  );
}

type Shown = EmbedRoute | Extract<Route, { name: 'match' }>;
type Target =
  | { readonly kind: 'lobby' }
  | { readonly kind: 'match'; readonly code: string }
  | { readonly kind: 'board' }
  | { readonly kind: 'profile'; readonly name: string };

// What the frame shows: a profile without a name is the viewer's own, or the lobby.
function targetOf(route: Shown, ownName: string | null): Target {
  if (route.name === 'match') return { kind: 'match', code: route.code };
  if (route.view === 'match' && route.param !== null) return { kind: 'match', code: route.param };
  if (route.view === 'leaderboard') return { kind: 'board' };
  const name = route.view === 'profile' ? (route.param ?? ownName) : null;
  return name === null ? { kind: 'lobby' } : { kind: 'profile', name };
}

// Keyed by account: the handoff's sign-in mounts the view fresh.
function View({ route }: { readonly route: Shown }): ReactElement {
  const account = useSession().session?.account ?? null;
  const who = account?.id ?? 'guest';
  const target = targetOf(route, account?.displayName ?? null);
  switch (target.kind) {
    case 'match':
      return <MatchPage key={`${who}/${target.code}`} code={target.code} />;
    case 'board':
      return <LeaderboardPage key={who} periodId={null} />;
    case 'profile':
      return <ProfilePage key={target.name} displayName={target.name} />;
    case 'lobby':
      return <Lobby key={who} dev={false} />;
  }
}
