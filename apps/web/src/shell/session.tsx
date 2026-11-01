/**
 * @file   apps/web/src/shell/session.tsx
 * @module web/shell
 * @brief  The signed-in session for the whole client: who, permissions, CSRF token.
 *
 * Responsibility: load GET /session on start, keep its CSRF token for ./http, and offer
 *                 the development quick sign-in (host, admin or player 1–3), sign-out, and the
 *                 sign-in with a host's handoff token (an embedded page, 07 §1).
 *                 Only the newest refresh sets the session (an older answer arriving late
 *                 never undoes a sign-in). Screens read it through `useSession`.
 * Depends on:     react, ./http
 * Used by:        ./AppShell and every screen that needs the account, ../account/*,
 *                 ../lobby/Lobby, ../main, ./DevTools
 * Spec:           Bingo 05 §2.1; Bingo 03 §3, §8
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import { resetSocket } from '../live/socket.js';
import { api, setCsrfToken } from './http.js';

interface SessionInfo {
  readonly signedIn: boolean;
  readonly account: { readonly id: string; readonly displayName: string } | null;
  readonly permissions: readonly string[];
  readonly csrfToken: string | null;
}

export type DevIdentity = 'host' | 'admin' | 'player-1' | 'player-2' | 'player-3';

interface SessionContextValue {
  readonly session: SessionInfo | null;
  readonly refresh: () => Promise<void>;
  readonly devSignIn: (as: DevIdentity) => Promise<void>;
  readonly signOut: () => Promise<void>;
  // Local accounts (05 §2.1); both throw ApiError with the server's code on refusal.
  readonly signIn: (email: string, password: string) => Promise<void>;
  readonly register: (account: NewAccount) => Promise<void>;
  // A host-signed token exchanged for a session (Bingo 07 §2.2).
  readonly handoff: (token: string) => Promise<void>;
  readonly can: (permission: string) => boolean;
}

interface NewAccount {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): ReactElement {
  const [session, setSession] = useState<SessionInfo | null>(null);
  // Only the latest refresh counts: the answer to an older one (e.g. the first load, still
  // on its way when a sign-in finished) must not undo a newer session.
  const latest = useRef(0);
  const refresh = useCallback(async () => {
    latest.current += 1;
    const mine = latest.current;
    const next = await api<SessionInfo>('/session');
    if (mine !== latest.current) return;
    setCsrfToken(next.csrfToken);
    setSession(next);
  }, []);
  useEffect(() => {
    // A failed first load shows "signed out", unless a newer refresh has answered meanwhile.
    refresh().catch(() => {
      setSession(
        (now) => now ?? { signedIn: false, account: null, permissions: [], csrfToken: null },
      );
    });
  }, [refresh]);
  const value = useMemo<SessionContextValue>(() => {
    // A new session: the game socket reconnects with the new cookie (06 §2).
    const changed = async (): Promise<void> => {
      resetSocket();
      await refresh();
    };
    return {
      session,
      refresh,
      devSignIn: async (as) => {
        await api('/dev/sign-in', { method: 'POST', body: { as } });
        await changed();
      },
      signOut: async () => {
        await api('/auth/logout', { method: 'POST', body: {} });
        await changed();
      },
      signIn: async (email, password) => {
        await api('/auth/login', { method: 'POST', body: { email, password } });
        await changed();
      },
      register: async (account) => {
        await api('/auth/register', { method: 'POST', body: account });
        await changed();
      },
      handoff: async (token) => {
        await api('/auth/handoff', { method: 'POST', body: { token } });
        await changed();
      },
      can: (permission) => session?.permissions.includes(permission) === true,
    };
  }, [session, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) throw new Error('useSession outside SessionProvider');
  return value;
}
