/**
 * @file   apps/web/src/main.tsx
 * @module web
 * @brief  Entry point of the player client: design system, session, app shell.
 *
 * Responsibility: load the shared design system (fonts, tokens, base styles, key-moment
 *                 motion from @smg/ui), then render the
 *                 app shell inside the session provider. Development-only parts (quick
 *                 sign-in, Quick Test, bots) follow Vite's DEV flag, so production builds
 *                 leave them out.
 * Depends on:     react-dom, @smg/ui (CSS), ./shell/*
 * Spec:           Bingo 01 §13; Bingo 15 WP-12
 */
import '@smg/ui/fonts.css';
import '@smg/ui/tokens.css';
import '@smg/ui/base.css';
import '@smg/ui/motion.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppShell } from './shell/AppShell.js';
import { SessionProvider } from './shell/session.js';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('missing #root element');
createRoot(rootElement).render(
  <StrictMode>
    <SessionProvider>
      <AppShell dev={import.meta.env.DEV} />
    </SessionProvider>
  </StrictMode>,
);
