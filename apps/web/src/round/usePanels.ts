/**
 * @file   apps/web/src/round/usePanels.ts
 * @module web/round
 * @brief  React hook: the focus mode's panels on demand, one open at a time (O46).
 *
 * Responsibility: which panel is open (chat, players, host, the full guess list), or none;
 *                 each panel's opening button by id, so closing a panel hands the focus back
 *                 to the button it was opened from (as @smg/ui `useDisclosure` does for a single
 *                 panel); opening another panel closes the open one, since only one is open at
 *                 a time. Escape and the panels' Close buttons call `close` (./FocusPanel).
 * Depends on:     react
 * Used by:        ./FocusShell, ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §12
 */
import { useCallback, useRef, useState } from 'react';

export type PanelId = 'chat' | 'players' | 'host' | 'list';

export interface Panels {
  readonly open: PanelId | null;
  readonly toggle: (id: PanelId) => void;
  readonly close: () => void;
  // The ref callback of a panel's opening button.
  readonly button: (id: PanelId) => (el: HTMLButtonElement | null) => void;
}

export function usePanels(): Panels {
  const [open, setOpen] = useState<PanelId | null>(null);
  // The open panel as of the last render, for the stable callbacks below.
  const current = useRef<PanelId | null>(null);
  current.current = open;
  const buttons = useRef(new Map<PanelId, HTMLButtonElement>());
  const close = useCallback((): void => {
    const was = current.current;
    setOpen(null);
    if (was !== null) buttons.current.get(was)?.focus();
  }, []);
  const toggle = useCallback(
    (id: PanelId): void => {
      if (current.current === id) close();
      else setOpen(id);
    },
    [close],
  );
  const button = useCallback(
    (id: PanelId) =>
      (el: HTMLButtonElement | null): void => {
        if (el === null) buttons.current.delete(id);
        else buttons.current.set(id, el);
      },
    [],
  );
  return { open, toggle, close, button };
}
