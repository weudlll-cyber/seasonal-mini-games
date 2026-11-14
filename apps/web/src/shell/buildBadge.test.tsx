// @vitest-environment jsdom
/**
 * @file   apps/web/src/shell/buildBadge.test.tsx
 * @module web/shell
 * @brief  The build badge's words in a production and a development build (DECISIONS T346).
 *
 * Responsibility: a production build shows the app, the short commit and the build date; a
 *                 development build also "dev" and the branch; the badge renders the values the
 *                 Vite config injected, as one line of muted text.
 * Depends on:     vitest, @testing-library/react, ./BuildBadge
 * Spec:           docs/spec/10-repository-structure.md §4
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BuildBadge, buildLabel } from './BuildBadge.js';

afterEach(cleanup);

const build = { commit: '1a2b3c4', date: '2026-11-14', branch: 'feat/mind-games' };

describe('the build badge (T346)', () => {
  it('names the app, the commit and the date; a dev build also dev and the branch', () => {
    expect(buildLabel({ ...build, branch: null }, false)).toBe('Mini Games · 1a2b3c4 · 2026-11-14');
    expect(buildLabel(build, true)).toBe(
      'Mini Games · dev · feat/mind-games · 1a2b3c4 · 2026-11-14',
    );
  });

  it('renders the values of this build in muted text', () => {
    render(<BuildBadge />);
    const badge = screen.getByTestId('build-badge');
    expect(badge.textContent).toMatch(/^Mini Games · dev · .+ · [0-9a-f]{7} · \d{4}-\d{2}-\d{2}$/);
    expect(badge.className).toContain('smg-muted');
  });
});
