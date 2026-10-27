/**
 * @file   apps/admin/src/App.tsx
 * @module admin
 * @brief  The admin app's frame: who is signed in, sign-in, and the areas they may open.
 *
 * Responsibility: load the session; without an account a sign-in form (and, in development
 *                 builds, "Sign in as admin"); with one the areas its permissions allow —
 *                 Live rounds and Settings (`admin.view`), Accounts (`account.view`), Seasons
 *                 (`season.manage`), Moderation (`chat.moderate`), Abuse (`abuse.view`), Audit
 *                 log (`audit.read`) and Two-factor (every account) — chosen with the
 *                 address's hash (08 §1, §2); the step-up dialog (./StepUp) for writes that
 *                 need a fresh two-factor check. The server checks every permission again.
 * Depends on:     react, ./http, ./SignIn, ./StepUp, ./live/LivePage, ./accounts/AccountsPage,
 *                 ./settings/SettingsPage, ./seasons/SeasonsPage, ./moderation/ModerationPage,
 *                 ./abuse/AbusePage, ./audit/AuditPage, ./twofactor/TwoFactorPage
 * Used by:        ./main
 * Spec:           docs/spec/08-admin-settings.md §1, §2; Bingo 11 §1, §2
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { AbusePage } from './abuse/AbusePage.js';
import { AccountsPage } from './accounts/AccountsPage.js';
import { AuditPage } from './audit/AuditPage.js';
import { api, setCsrfToken } from './http.js';
import { LivePage } from './live/LivePage.js';
import { ModerationPage } from './moderation/ModerationPage.js';
import { SeasonsPage } from './seasons/SeasonsPage.js';
import { SettingsPage } from './settings/SettingsPage.js';
import { SignIn } from './SignIn.js';
import { StepUp } from './StepUp.js';
import { TwoFactorPage } from './twofactor/TwoFactorPage.js';

export interface SessionInfo {
  readonly account: { readonly id: string; readonly displayName: string } | null;
  readonly permissions: readonly string[];
  readonly csrfToken: string | null;
}

// `null`: every signed-in account (its own two-factor sign-in).
const AREAS = [
  { hash: 'live', label: 'Live', permission: 'admin.view' },
  { hash: 'settings', label: 'Settings', permission: 'admin.view' },
  { hash: 'accounts', label: 'Accounts', permission: 'account.view' },
  { hash: 'seasons', label: 'Seasons', permission: 'season.manage' },
  { hash: 'moderation', label: 'Moderation', permission: 'chat.moderate' },
  { hash: 'abuse', label: 'Abuse', permission: 'abuse.view' },
  { hash: 'audit', label: 'Audit log', permission: 'audit.read' },
  { hash: 'two-factor', label: 'Two-factor', permission: null },
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
  const can = (p: string) => session.permissions.includes(p);
  switch (area) {
    case 'live':
      return (
        <LivePage
          rights={{
            abort: can('match.abort'),
            kick: can('match.manage'),
            removeResult: can('leaderboard.adjust'),
          }}
        />
      );
    case 'accounts':
      return (
        <AccountsPage rights={{ suspend: can('account.suspend'), roles: can('role.assign') }} />
      );
    case 'moderation':
      return <ModerationPage />;
    case 'two-factor':
      return <TwoFactorPage />;
    case 'settings':
      return <SettingsPage />;
    case 'seasons':
      return <SeasonsPage />;
    case 'abuse':
      return <AbusePage canSuspend={can('account.suspend')} />;
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
  const open = AREAS.filter(
    (a) => a.permission === null || session.permissions.includes(a.permission),
  );
  // An account without staff rights opens Two-factor only when it asks for it.
  const staff = open.some((a) => a.permission !== null);
  const current = open.find((a) => hash.startsWith(a.hash)) ?? (staff ? open[0] : undefined);
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
      <StepUp />
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
