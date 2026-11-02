/**
 * @file   packages/ui/src/useDisclosure.ts
 * @module ui
 * @brief  React hook: a button that opens and closes a panel, closed again with Escape.
 *
 * Responsibility: the open state, the panel's id for `aria-controls`, the button's ref, and
 *                 `close`, which hands the focus back to the button (where the person was
 *                 before opening). `onKeyDown` goes on the element around button and panel,
 *                 so Escape closes from anywhere inside (only the innermost open menu when
 *                 menus are nested). One behaviour for the host menu, the account menu of
 *                 the compact top bar, the development sign-in menu, the waiting area's chat on
 *                 a phone, the season pill's note and a game's sheets (Guess The Number's
 *                 fallen numbers). The round's focus mode keeps several panels, one open at a
 *                 time, with the same focus rules (apps/web round/usePanels).
 * Depends on:     react
 * Used by:        ./index; apps/web (match/HostMenu, round/RoundChat, round/SeasonPill,
 *                 shell/AppShell, shell/DevTools); the games' web sheets
 * Spec:           docs/spec/02-game-guess-the-number.md §12 (keyboard play); Bingo 01 §13
 */
import { useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

export interface Disclosure {
  readonly open: boolean;
  readonly toggle: () => void;
  readonly close: () => void;
  readonly panelId: string;
  readonly button: RefObject<HTMLButtonElement | null>;
  readonly onKeyDown: (e: KeyboardEvent) => void;
}

export function useDisclosure(initiallyOpen = false): Disclosure {
  const [open, setOpen] = useState(initiallyOpen);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const close = (): void => {
    setOpen(false);
    button.current?.focus();
  };
  return {
    open,
    toggle: () => {
      setOpen((o) => !o);
    },
    close,
    panelId,
    button,
    onKeyDown: (e) => {
      if (e.key !== 'Escape' || !open) return;
      // Only the innermost open menu closes (the development menu sits inside the account menu).
      e.stopPropagation();
      close();
    },
  };
}
