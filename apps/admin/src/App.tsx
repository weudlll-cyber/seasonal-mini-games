/**
 * @file   apps/admin/src/App.tsx
 * @module admin
 * @brief  The admin app's frame: who is signed in, sign-in, and the areas they may open.
 *
 * Responsibility: load the session; without an account a sign-in form (and, in development
 *                 builds, "Sign in as admin"); with one the areas its permissions allow —
 *                 Settings (`admin.view`), Seasons (`season.manage`), Abuse (`abuse.view`),
 *                 Audit log (`audit.read`) — chosen with the address's hash (08 §1, §2). The
 *                 server checks every permission again.
 * Depends on:     react, ./http, ./SignIn, ./settings/SettingsPage, ./seasons/SeasonsPage,
 *                 ./abuse/AbusePage, ./audit/AuditPage
 * Used by:        ./main
 * Spec:           docs/spec/08-admin-settings.md §1, §2; Bingo 11 §1, §2
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { AbusePage } from './abuse/AbusePage.js';
import { AuditPage } from './audit/AuditPage.js';
import { api, setCsrfToken } from './http.js';
import { SeasonsPage } from './seasons/SeasonsPage.js';
import { SettingsPage } from './settings/SettingsPage.js';
import { SignIn } from './SignIn.js';

export interface SessionInfo {
  readonly account: { readonly id: string; readonly displayName: string } | null;
  readonly permissions: readonly string[];
  readonly csrfToken: string | null;
}

const AREAS = [
  { hash: 'settings', label: 'Settings', permission: 'admin.view' },
  { hash: 'seasons', label: 'Seasons', permission: 'season.manage' },
  { hash: 'abuse', label: 'Abuse', permission: 'abuse.view' },
  { hash: 'audit', label: 'Audit log', permission: 'audit.read' },
] as const;
type Area = (typeof AREAS)[number]['hash'];

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#\/?/, ''));
  useEffect(() => {
    const on = (): void => {
      setHash(window.location.hash.replace(/^#\/?/, ''));
    };
    window.addEventListener('hashchange', on);
    return () => {
      window.removeEventListener('hashchange', on);
    };
  }, []);
  return hash;
}

function Area({
  area,
  session,
}: {
  readonly area: Area;
  readonly session: SessionInfo;
}): ReactElement {
  switch (area) {
    case 'settings':
      return <SettingsPage />;
    case 'seasons':
      return <SeasonsPage />;
    case 'abuse':
      return <AbusePage canSuspend={session.permissions.includes('account.suspend')} />;
    case 'audit':
      return <AuditPage />;
  }
}

export function App({ dev }: { readonly dev: boolean }): ReactElement {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const hash = useHash();
  const refresh = useCallback(async () => {
    const s = await api<SessionInfo>('/session');
    setCsrfToken(s.csrfToken);
    setSession(s);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  if (session === null) return <p className="smg-muted admin-main">Loading…</p>;
  if (session.account === null) return <SignIn dev={dev} done={refresh} />;
  const open = AREAS.filter((a) => session.permissions.includes(a.permission));
  const current = open.find((a) => hash.startsWith(a.hash)) ?? open[0];
  return (
    <>
      <header className="admin-bar">
        <strong>Seasonal Mini Games · Admin</strong>
        <nav aria-label="Areas">
          {open.map((a) => (
            <a key={a.hash} href={`#/${a.hash}`} aria-current={a === current ? 'page' : undefined}>
              {a.label}
            </a>
          ))}
        </nav>
        <span className="smg-chip">{session.account.displayName}</span>
      </header>
      <main className="admin-main">
        {current === undefined ? (
          <p>This account has no admin rights.</p>
        ) : (
          <Area area={current.hash} session={session} />
        )}
      </main>
    </>
  );
}
