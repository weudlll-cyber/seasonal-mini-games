/**
 * @file   apps/web/src/shell/DevTools.tsx
 * @module web/shell
 * @brief  Development-only parts of the client: the "Dev sign-in" menu and the Quick Test link.
 *
 * Responsibility: a compact "Dev sign-in" menu with "Sign in as host" / "admin" / "player
 *                 1/2/3" and a hint that one window holds one sign-in; the lobby's link to the
 *                 Quick Test. Loaded on demand by ./AppShell and ../lobby/Lobby only
 *                 when Vite's DEV flag is set, so a production bundle does not contain it.
 * Depends on:     react, ./session
 * Used by:        ./AppShell, ../lobby/Lobby (lazy imports)
 * Spec:           Bingo 05 §2.1; Bingo 01 §13
 */
import { useState, type ReactElement } from 'react';

import { hrefOf } from './router.js';
import { useSession, type DevIdentity } from './session.js';

const DEV_IDENTITIES: readonly { readonly as: DevIdentity; readonly label: string }[] = [
  { as: 'host', label: 'Sign in as host' },
  { as: 'admin', label: 'Sign in as admin' },
  { as: 'player-1', label: 'Sign in as player 1' },
  { as: 'player-2', label: 'Sign in as player 2' },
  { as: 'player-3', label: 'Sign in as player 3' },
];

// One compact menu instead of four buttons in the bar.
export function DevSignIn(): ReactElement {
  const { devSignIn } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <div className="dev-menu">
      <button
        type="button"
        className="smg-btn"
        aria-expanded={open}
        data-testid="dev-menu"
        onClick={() => {
          setOpen(!open);
        }}
      >
        Dev sign-in
      </button>
      {open ? (
        <div className="dev-menu-panel smg-panel" role="menu">
          {DEV_IDENTITIES.map((d) => (
            <button
              key={d.as}
              type="button"
              role="menuitem"
              className="smg-btn"
              data-testid={`dev-sign-in-${d.as}`}
              onClick={() => {
                setOpen(false);
                void devSignIn(d.as);
              }}
            >
              {d.label}
            </button>
          ))}
          <p className="smg-muted dev-menu-hint">
            One window holds one sign-in — use a private window or another browser for a second
            person.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function QuickTestLink(): ReactElement {
  return (
    <a className="smg-btn" href={hrefOf({ name: 'quickTest' })} data-testid="quick-test-link">
      Quick Test against bots
    </a>
  );
}
