/**
 * @file   apps/web/src/shell/DevTools.tsx
 * @module web/shell
 * @brief  Development-only parts of the client: the "Dev sign-in" menu and the Quick Test link.
 *
 * Responsibility: the kit's "Dev sign-in" menu (@seasonal/kit/react/dev DevSignIn: one button,
 *                 a panel with the identities and the hint that one window holds one sign-in;
 *                 Escape, a pick or a press outside close it; a failed sign-in is an alert)
 *                 with the game's identities, "Sign in as host" / "admin" / "player 1/2/3",
 *                 and its call (./session devSignIn); the lobby's link to the Quick Test.
 *                 Loaded on demand by ./AppShell and ../lobby/Lobby only when Vite's DEV flag
 *                 is set, so a production bundle does not contain it.
 * Depends on:     react, @seasonal/kit/react/dev (DevSignIn), ./router, ./session
 * Used by:        ./AppShell, ../lobby/Lobby (lazy imports)
 * Spec:           Bingo 05 §2.1; Bingo 01 §13
 */
import { DevSignIn as KitDevSignIn } from '@seasonal/kit/react/dev';
import type { ReactElement } from 'react';

import { hrefOf } from './router.js';
import { useSession, type DevIdentity } from './session.js';

const DEV_IDENTITIES: readonly { readonly as: DevIdentity; readonly label: string }[] = [
  { as: 'host', label: 'Sign in as host' },
  { as: 'admin', label: 'Sign in as admin' },
  { as: 'player-1', label: 'Sign in as player 1' },
  { as: 'player-2', label: 'Sign in as player 2' },
  { as: 'player-3', label: 'Sign in as player 3' },
];

const isIdentity = (as: string): as is DevIdentity => DEV_IDENTITIES.some((d) => d.as === as);

export function DevSignIn(): ReactElement {
  const { devSignIn } = useSession();
  return (
    <KitDevSignIn
      identities={DEV_IDENTITIES}
      onSignIn={(as) => (isIdentity(as) ? devSignIn(as) : Promise.resolve())}
      buttonClassName="smg-btn"
    />
  );
}

export function QuickTestLink(): ReactElement {
  return (
    <a className="smg-btn" href={hrefOf({ name: 'quickTest' })} data-testid="quick-test-link">
      Quick Test against bots
    </a>
  );
}
