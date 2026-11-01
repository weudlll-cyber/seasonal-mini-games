/**
 * @file   apps/web/src/shell/handoffLanding.ts
 * @module web/shell
 * @brief  The one-time redirect form of the handoff: `/auth/handoff#token=…` signs the player in.
 *
 * Responsibility: the server sends `/auth/handoff` on to `?handoff` (the browser keeps the
 *                 fragment); here the token is taken from the fragment, the address is cleared
 *                 at once (no token stays in history or reaches a log), and the token is posted
 *                 to POST /auth/handoff. A refused token leaves the player signed out.
 * Depends on:     ./http
 * Used by:        ../main
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §2.2
 */
import { api } from './http.js';

export async function redeemHandoffLanding(): Promise<void> {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('handoff')) return;
  const token = /^#token=([^&]+)/.exec(url.hash)?.[1];
  window.history.replaceState(null, '', `${url.pathname}#/`);
  if (token === undefined) return;
  await api('/auth/handoff', { method: 'POST', body: { token: decodeURIComponent(token) } }).catch(
    () => undefined,
  );
}
