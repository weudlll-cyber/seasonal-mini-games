/**
 * @file   apps/admin/src/main.tsx
 * @module admin
 * @brief  Entry point of the admin app: design system and the app.
 *
 * Responsibility: load the shared design system from @smg/ui (fonts, tokens, base styles),
 *                 then render the app. Development builds offer the quick admin sign-in.
 * Depends on:     react-dom, @smg/ui (CSS), ./App
 * Spec:           docs/spec/08-admin-settings.md §1
 */
import '@smg/ui/fonts.css';
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
