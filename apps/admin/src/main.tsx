/**
 * @file   apps/admin/src/main.tsx
 * @module admin
 * @brief  Entry point of the admin app: design system and the app.
 *
 * Responsibility: load the design system (the kit's fonts and shared tokens, then the game's
 *                 tokens and base styles from @smg/ui), then render the app. Development builds offer the quick admin sign-in.
 * Depends on:     react-dom, @seasonal/kit (CSS), @smg/ui (CSS), ./App
 * Spec:           docs/spec/08-admin-settings.md §1
 */
// The kit's shared parts first; the game's own tokens and styles build on them.
import '@seasonal/kit/fonts.css';
import '@seasonal/kit/tokens.css';
import '@smg/ui/tokens.css';
import '@smg/ui/base.css';
import './admin.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.js';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('missing #root element');
createRoot(rootElement).render(
  <StrictMode>
    <App dev={import.meta.env.DEV} />
  </StrictMode>,
);
