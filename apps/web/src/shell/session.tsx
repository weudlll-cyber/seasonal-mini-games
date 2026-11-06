/**
 * @file   apps/web/src/shell/session.tsx
 * @module web/shell
 * @brief  The signed-in session for the whole client: who, permissions, CSRF token.
 *
 * Responsibility: load GET /session on start, keep its CSRF token for ./http, and offer
 *                 the development quick sign-in (host, admin or player 1–3), sign-out, the
 *                 sign-in with a host's handoff token (an embedded page, 07 §1), and the
 *                 deletion of the own account (DELETE /me, which ends every session).
 *                 Only the newest refresh sets the session (an older answer arriving late
 *                 never undoes a sign-in). Screens read it through `useSession`.
 *                 Website mode (O66): the sign-in address with the page shown now as `next`
 *                 (`websiteSignInHref`), and a guest session for a signed-out visitor who
 *                 watches a match (`useWatchSession`, POST /auth/guest, DECISIONS T221).
 * Depends on:     react, @smg/contracts (SessionView), ./http, ../live/socket
 * Used by:        ./AppShell and every screen that needs the account, ../account/*,
 *                 ../lobby/Lobby, ../main, ./DevTools
 * Spec:           Bingo 05 §2.1; Bingo 03 §3, §8; docs/spec/07-integration.md §7
 */
import type { SessionView } from '@smg/contracts';
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

// `hasPassword`: false for an account the website made (T201). `kind` null: no session at
// all, not even a guest's. `authMode`, `signInPath`: how players sign in here (O66).
type SessionInfo = Pick<
  SessionView,
  'signedIn' | 'kind' | 'account' | 'permissions' | 'csrfToken' | 'authMode' | 'signInPath'
>;

const SIGNED_OUT: SessionInfo = {
  signedIn: false,
  kind: null,
  account: null,
  permissions: [],
  csrfToken: null,
  authMode: 'local',
  signInPath: null,
};

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
  // A guest session, to watch a match (website mode, DECISIONS T221).
  readonly startGuest: () => Promise<void>;
  // DELETE /me: the display name typed, and the password for an account that has one
  // (DECISIONS T105); throws ApiError on refusal.
  readonly deleteAccount: (confirm: DeleteConfirm) => Promise<void>;
  readonly can: (permission: string) => boolean;
}

interface NewAccount {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
}

interface DeleteConfirm {
  readonly confirm: string;
  readonly password?: string;
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
      setSession((now) => now ?? SIGNED_OUT);
    });
  }, [refresh]);
  const value = useMemo<SessionContextValue>(() => {
    // A call that changes the session: then the game socket reconnects with the new cookie
    // (06 §2) and the session is read again.
    const changing = async (path: string, body: unknown, method = 'POST'): Promise<void> => {
      await api(path, { method, body });
      resetSocket();
      await refresh();
    };
    return {
      session,
      refresh,
      devSignIn: (as) => changing('/dev/sign-in', { as }),
      signOut: () => changing('/auth/logout', {}),
      signIn: (email, password) => changing('/auth/login', { email, password }),
      register: (account) => changing('/auth/register', account),
      handoff: (token) => changing('/auth/handoff', { token }),
      startGuest: () => changing('/auth/guest', {}),
      // The server has ended the sessions and cleared the cookie: no logout call follows.
      deleteAccount: (confirm) => changing('/me', confirm, 'DELETE'),
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

// Website mode: the sign-in route with the page shown now as `next` (07 §7, Bingo D43); a
// visitor the website does not know goes on to its login and comes back here signed in.
export function websiteSignInHref(signInPath: string): string {
  const { pathname, search, hash } = window.location;
  return `${signInPath}?next=${encodeURIComponent(`${pathname}${search}${hash}`)}`;
}

// True once a match can be watched: in website mode a signed-out visitor first gets a guest
// session (the match socket needs one, T221); if that is refused, the match opens anyway with
// what needs no session. Local mode is unchanged: nothing is started.
export function useWatchSession(): boolean {
  const { session, startGuest } = useSession();
  const [refused, setRefused] = useState(false);
  // One request per page, also when React runs the effect twice (development's strict mode).
  const started = useRef(false);
  const needed = session?.authMode === 'website' && session.kind === null && !refused;
  useEffect(() => {
    if (!needed || started.current) return;
    started.current = true;
    startGuest().catch(() => {
      setRefused(true);
    });
  }, [needed, startGuest]);
  return session !== null && !needed;
}
