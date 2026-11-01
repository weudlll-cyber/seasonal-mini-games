/**
 * @file   apps/web/src/embed/embedHost.ts
 * @module web/embed
 * @brief  The embedded client's side of the postMessage protocol with its host page.
 *
 * Responsibility: find the embedding page's origin and check it against the allowlist the server
 *                 publishes (GET /public/embed-config): a page not on it gets nothing. For an
 *                 allowed host, post `smg:ready`, `smg:resize` as the page grows, `smg:auth:request`
 *                 when signed out (handoff hosts only), `smg:event` when a watched round ends; take
 *                 `smg:auth:token` and `smg:auth:logout` from that host's window only. Every
 *                 message names its target origin, never `*` (Bingo 07 §3.3).
 * Depends on:     react, @smg/contracts (EmbedConfigView), ../live/socket, ../shell/http, ../shell/session
 * Used by:        ./EmbedShell
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §3.3, §3.4
 */
import type { EmbedConfigView } from '@smg/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { gameSocket } from '../live/socket.js';
import { api } from '../shell/http.js';
import { useSession } from '../shell/session.js';

type HostState = 'checking' | 'refused' | 'allowed';

// The embedding page's origin: Chromium and WebKit name it, Firefox gives the referrer.
function parentOrigin(): string | null {
  if (window.parent === window) return null;
  if ('ancestorOrigins' in window.location && window.location.ancestorOrigins.length > 0) {
    return window.location.ancestorOrigins.item(0);
  }
  try {
    return document.referrer === '' ? null : new URL(document.referrer).origin;
  } catch {
    return null;
  }
}

interface Host {
  readonly origin: string;
  readonly handoff: boolean;
}

function useHost(): { state: HostState; host: Host | null } {
  const [config, setConfig] = useState<EmbedConfigView | null>(null);
  useEffect(() => {
    api<EmbedConfigView>('/public/embed-config')
      .then(setConfig)
      .catch(() => {
        setConfig({ origins: [], handoffOrigins: [] });
      });
  }, []);
  if (config === null) return { state: 'checking', host: null };
  const origin = parentOrigin();
  if (origin === null || !config.origins.includes(origin)) return { state: 'refused', host: null };
  return { state: 'allowed', host: { origin, handoff: config.handoffOrigins.includes(origin) } };
}

interface Message {
  readonly source?: unknown;
  readonly v?: unknown;
  readonly type?: unknown;
  readonly payload?: { readonly jwt?: unknown } | null;
}

// Messages from the host window and origin only, in the `smg` envelope.
function useHostMessages(host: Host | null): void {
  const { handoff, signOut } = useSession();
  useEffect(() => {
    if (host === null) return;
    const onMessage = (event: MessageEvent<unknown>): void => {
      if (event.source !== window.parent || event.origin !== host.origin) return;
      if (typeof event.data !== 'object' || event.data === null) return;
      const m = event.data as Message;
      if (m.source !== 'smg' || m.v !== 1) return;
      const jwt = m.payload?.jwt;
      if (m.type === 'smg:auth:token' && host.handoff && typeof jwt === 'string') {
        handoff(jwt).catch(() => undefined);
      }
      if (m.type === 'smg:auth:logout') signOut().catch(() => undefined);
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [host, handoff, signOut]);
}

export function useEmbedHost(view: string, watching: boolean): HostState {
  const { state, host } = useHost();
  const { session } = useSession();
  const origin = host?.origin ?? null;
  const post = useCallback(
    (type: string, payload: unknown) => {
      if (origin !== null)
        window.parent.postMessage({ source: 'smg', v: 1, type, payload }, origin);
    },
    [origin],
  );
  useHostMessages(host);
  useEffect(() => {
    if (origin === null) return;
    post('smg:ready', { view });
    const observer = new ResizeObserver(() => {
      post('smg:resize', { height: document.documentElement.scrollHeight });
    });
    observer.observe(document.body);
    return () => {
      observer.disconnect();
    };
  }, [origin, post, view]);
  // Signed out on a host that may hand off a sign-in: ask it once (single sign-on).
  const asked = useRef(false);
  const signedOut = session !== null && !session.signedIn;
  useEffect(() => {
    if (host?.handoff !== true || !signedOut || asked.current) return;
    asked.current = true;
    post('smg:auth:request', {});
  }, [host, signedOut, post]);
  useRoundEnds(watching && origin !== null, session?.account?.id ?? null, post);
  return state;
}

interface Frame {
  readonly roundId?: string;
  readonly events?: readonly ({ readonly event: { readonly type?: string } | null } | null)[];
}

// A round's end, as the room learns it (under Frost once released), told to the host page.
function useRoundEnds(
  on: boolean,
  who: string | null,
  post: (type: string, payload: unknown) => void,
): void {
  useEffect(() => {
    if (!on) return;
    // The socket of the current session (a sign-in replaces it, hence `who`).
    const socket = gameSocket();
    const onFrame = (frame: Frame): void => {
      if (frame.events?.some((e) => e?.event?.type === 'RoundEnded') === true) {
        post('smg:event', { kind: 'round.ended', roundId: frame.roundId ?? null });
      }
    };
    socket.on('events', onFrame);
    return () => {
      socket.off('events', onFrame);
    };
  }, [on, who, post]);
}
