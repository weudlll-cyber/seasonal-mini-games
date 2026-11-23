/**
 * @file   apps/web/src/shell/theme.ts
 * @module web/shell
 * @brief  Light and dark theme in React, on the kit's theme logic.
 *
 * Responsibility: `useTheme` resolves the theme as the kit's early script does before the
 *                 first paint (a stored choice, localStorage `se.theme`, wins; otherwise the
 *                 system setting), follows the system setting live while nothing is stored,
 *                 and flips and stores the choice on the toggle. `useShownTheme` follows
 *                 <html data-theme> for parts that must match it (the website's chat frame,
 *                 07 §2). The logic (storage in try/catch, the media query, the observer) is
 *                 the kit's; these hooks only hold it in React state.
 * Depends on:     react, @seasonal/kit (resolveTheme, storeTheme, applyTheme,
 *                 onSystemThemeChange, shownTheme, onShownThemeChange)
 * Used by:        ./ThemeToggle, ../chat/ChatPanel
 * Spec:           Bingo 01 §13; Seasonal Entertainment docs/DESIGN.md "Theme logic"
 */
import {
  applyTheme,
  onShownThemeChange,
  onSystemThemeChange,
  resolveTheme,
  shownTheme,
  storeTheme,
  type Theme,
} from '@seasonal/kit';
import { useEffect, useState, useSyncExternalStore } from 'react';

export function useTheme(): { readonly theme: Theme; readonly toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(resolveTheme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  // The system setting is followed live while no choice is stored.
  useEffect(() => onSystemThemeChange(setTheme), []);
  const toggle = (): void => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    storeTheme(next);
    setTheme(next);
  };
  return { theme, toggle };
}

export function useShownTheme(): Theme | 'auto' {
  return useSyncExternalStore(onShownThemeChange, shownTheme);
}
