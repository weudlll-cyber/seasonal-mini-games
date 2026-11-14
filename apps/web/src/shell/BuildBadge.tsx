/**
 * @file   apps/web/src/shell/BuildBadge.tsx
 * @module web/shell
 * @brief  The build badge: which build this page is, in small text at the bottom right.
 *
 * Responsibility: show "Mini Games · <short commit> · <build date>" on every page of the app
 *                 shell, in every build; a development build adds "dev" and the branch
 *                 ("Mini Games · dev · <branch> · <commit> · <date>"). The values come from the
 *                 Vite config (`__SMG_BUILD__`: git at the build or at the dev server's start;
 *                 a Docker build passes the commit in SMG_BUILD_COMMIT). It stands in the page's
 *                 flow after the main column, never over it (./buildBadge.css), so it covers no
 *                 chat, round view or button (owner, 2026-11-14; DECISIONS T346).
 * Depends on:     react, ./buildBadge.css
 * Used by:        ./AppShell
 * Spec:           docs/spec/10-repository-structure.md §4
 */
import type { ReactElement } from 'react';

import './buildBadge.css';

interface BuildInfo {
  readonly commit: string;
  readonly date: string;
  // Only in a development build.
  readonly branch: string | null;
}

declare const __SMG_BUILD__: BuildInfo;

export function buildLabel(build: BuildInfo, dev: boolean): string {
  const where = dev ? ['dev', build.branch ?? 'no branch'] : [];
  return ['Mini Games', ...where, build.commit, build.date].join(' · ');
}

export function BuildBadge(): ReactElement {
  return (
    <p className="build-badge smg-muted" data-testid="build-badge">
      {buildLabel(__SMG_BUILD__, import.meta.env.DEV)}
    </p>
  );
}
