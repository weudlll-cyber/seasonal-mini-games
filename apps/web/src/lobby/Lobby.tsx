/**
 * @file   apps/web/src/lobby/Lobby.tsx
 * @module web/lobby
 * @brief  The lobby: where players find matches. Foundation version: a welcome line only.
 *
 * Responsibility: greet the signed-in player or invite a visitor to sign in. The match list
 *                 and hosting arrive with the round screens (spec 02 §2, roadmap Phase 2).
 * Depends on:     react, ../shell/session, ../shell/router
 * Used by:        ../shell/AppShell
 * Spec:           docs/spec/02-game-guess-the-number.md §2
 */
import type { ReactElement } from 'react';

import { hrefOf } from '../shell/router.js';
import { useSession } from '../shell/session.js';

export function Lobby(): ReactElement {
  const { session } = useSession();
  const name = session?.account?.displayName ?? null;
  return (
    <section className="smg-panel" data-testid="lobby">
      <h1>Seasonal Mini Games</h1>
      {name === null ? (
        <p>
          <a href={hrefOf({ name: 'signIn' })}>Sign in</a> or{' '}
          <a href={hrefOf({ name: 'register' })}>register</a> to play.
        </p>
      ) : (
        <p>Welcome, {name}. No match is open yet.</p>
      )}
    </section>
  );
}
