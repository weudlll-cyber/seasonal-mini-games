/**
 * @file   apps/web/src/round/FocusPanel.tsx
 * @module web/round
 * @brief  One panel on demand of the focus mode: a drawer from the right, a sheet on a phone.
 *
 * Responsibility: a titled panel (O46): on a desktop a column of 360 px beside the game that
 *                 pushes it aside, on a phone a sheet that ends above the input row (O48,
 *                 ./focus.css); a visible Close button; Escape closes it from anywhere inside;
 *                 on opening the focus moves to the panel itself, its ring drawn only for the
 *                 keyboard, and closing hands it back to the opening button (./usePanels). No
 *                 backdrop, so the game stays usable beside it. `keep` keeps a closed panel's content
 *                 mounted but hidden (the chat keeps its room and what was typed, 07 §2);
 *                 otherwise the content mounts only while the panel is open.
 * Depends on:     react, ./focus.css
 * Used by:        ./FocusShell, ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/07-integration.md §2
 */
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

import './focus.css';

export interface FocusPanelProps {
  readonly title: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly keep?: boolean;
  readonly testId?: string;
  readonly children: ReactNode;
}

export function FocusPanel(p: FocusPanelProps): ReactElement | null {
  const id = useId();
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    if (p.open) box.current?.focus();
  }, [p.open]);
  if (!p.open && p.keep !== true) return null;
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    // Only this panel closes, not a menu around the round view.
    e.stopPropagation();
    p.onClose();
  };
  return (
    <section
      ref={box}
      tabIndex={-1}
      className="focus-panel"
      role="dialog"
      aria-labelledby={`${id}-title`}
      hidden={!p.open}
      onKeyDown={onKeyDown}
      data-testid={p.testId}
    >
      <header className="focus-panel-head">
        <h2 id={`${id}-title`}>{p.title}</h2>
        <button type="button" className="smg-btn" onClick={p.onClose}>
          Close
        </button>
      </header>
      <div className="focus-panel-body">{p.children}</div>
    </section>
  );
}
