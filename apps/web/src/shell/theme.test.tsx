// @vitest-environment jsdom
/**
 * @file   apps/web/src/shell/theme.test.tsx
 * @module web/shell
 * @brief  The theme toggle stores the choice; the system setting is followed live until then.
 *
 * Responsibility: the toggle flips and stores the choice; a change of the system setting is
 *                 followed only while nothing is stored. That the kit's early script and its
 *                 theme functions resolve alike is the kit's own test (src/theme.test.ts).
 * Depends on:     @testing-library/react, vitest, ./ThemeToggle
 * Spec:           Bingo 01 §13; Seasonal Entertainment docs/DESIGN.md "Theme logic"
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeToggle } from './ThemeToggle.js';

let systemDark = false;
let listeners: (() => void)[] = [];

function system(dark: boolean): void {
  systemDark = dark;
  vi.stubGlobal('matchMedia', () => ({
    matches: systemDark,
    addEventListener: (_t: string, l: () => void) => listeners.push(l),
    removeEventListener: () => undefined,
  }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  listeners = [];
  document.documentElement.removeAttribute('data-theme');
});

describe('the toggle', () => {
  it('flips and stores the choice; the system is followed only while nothing is stored', () => {
    system(false);
    render(<ThemeToggle />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    // Nothing stored: a system change to dark is followed live.
    act(() => {
      systemDark = true;
      for (const l of listeners) l();
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    fireEvent.click(screen.getByTestId('theme-toggle'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem('se.theme')).toBe('light');
    expect(screen.getByTestId('theme-toggle').getAttribute('aria-label')).toBe(
      'Switch to dark theme',
    );
    // Now a choice is stored: the system setting no longer changes the theme.
    act(() => {
      systemDark = true;
      for (const l of listeners) l();
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
