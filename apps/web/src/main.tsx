/**
 * @file   apps/web/src/main.tsx
 * @module web
 * @brief  Entry point of the player client: design system, session, app shell or embed frame.
 *
 * Responsibility: load the design system (the kit's fonts, shared tokens, win glow with the
 *                 reduced-motion rule, shell parts, fit floors, frames and the phase strip's
 *                 bar styles, then the game's tokens and base styles from @smg/ui), redeem a
 *                 handoff landing (`?handoff#token=…`), then render the app shell, or, for a page opened at
 *                 `#/embed/…` inside a host page, the embed frame, inside the session provider.
 *                 Development-only parts (quick sign-in, Quick Test, bots) follow Vite's DEV
 *                 flag, so production builds leave them out.
 * Depends on:     react-dom, @seasonal/kit (CSS), @smg/ui (CSS), ./shell/*, ./embed/EmbedShell
 * Spec:           Bingo 01 §13; Bingo 15 WP-12; docs/spec/07-integration.md §1
 */
// The kit's shared parts first; the game's own tokens and styles build on them.
import '@seasonal/kit/fonts.css';
import '@seasonal/kit/tokens.css';
import '@seasonal/kit/motion.css';
import '@seasonal/kit/shell.css';
import '@seasonal/kit/fit.css';
import '@seasonal/kit/frames.css';
import '@seasonal/kit/bar.css';
import '@smg/ui/tokens.css';
import '@smg/ui/base.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { EmbedShell } from './embed/EmbedShell.js';
import { AppShell } from './shell/AppShell.js';
import { redeemHandoffLanding } from './shell/handoffLanding.js';
import { parseRoute } from './shell/router.js';
import { SessionProvider } from './shell/session.js';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('missing #root element');
const root = rootElement;

// A page opened at an embed route stays the embed frame for its whole life.
const first = parseRoute(window.location.hash);

void redeemHandoffLanding().finally(() => {
  createRoot(root).render(
    <StrictMode>
      <SessionProvider>
        {first.name === 'embed' ? (
          <EmbedShell first={first} />
        ) : (
          <AppShell dev={import.meta.env.DEV} />
        )}
      </SessionProvider>
    </StrictMode>,
  );
});
