/**
 * @file   apps/web/src/round/FocusBar.tsx
 * @module web/round
 * @brief  The focus mode's one slim game bar over a running round (O46).
 *
 * Responsibility: one row, at most 56 px on a desktop and 64 px on a phone (./focus.css): the
 *                 season pill with the special's note (./SeasonPill), shared or individual (a
 *                 desktop only), "Wait 15 s · 9:50 left" (the round's cooldown and, once open,
 *                 the time left; the countdown's seconds are the intro's), then the buttons of
 *                 the panels on demand (./usePanels): Chat with the unread count (only with a
 *                 chat, the provider not `none`), Players with the teams, Host (the host only),
 *                 and the full-screen toggle where the browser offers it (./useFullscreen).
 *                 Each button names itself; a phone shows the icons and reads the words out.
 * Depends on:     react, @smg/contracts, ./FocusIcons, ./SeasonPill, ./roundText, ./useFullscreen,
 *                 ./usePanels
 * Used by:        ./FocusShell
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §6
 */
import type { RoundStateView } from '@smg/contracts';
import type { ReactElement } from 'react';

import { FocusIcon, type IconName } from './FocusIcons.js';
import { SeasonPill } from './SeasonPill.js';
import { seconds } from './roundText.js';
import type { Fullscreen } from './useFullscreen.js';
import type { PanelId, Panels } from './usePanels.js';

// The time left of an open round, "9:30"; null before it opens.
export function timeText(state: RoundStateView, now: number): string | null {
  if (state.status !== 'open' || state.endsAt === null) return null;
  const left = Math.max(0, state.endsAt - now);
  const secs = Math.floor((left % 60_000) / 1_000);
  return `${String(Math.floor(left / 60_000))}:${String(secs).padStart(2, '0')}`;
}

function PanelButton(p: {
  readonly id: PanelId;
  readonly panels: Panels;
  readonly icon: IconName;
  readonly label: string;
  readonly testId: string;
  readonly badge?: number;
}): ReactElement {
  const open = p.panels.open === p.id;
  return (
    <button
      ref={p.panels.button(p.id)}
      type="button"
      className="smg-btn focus-button"
      aria-expanded={open}
      data-testid={p.testId}
      onClick={() => {
        p.panels.toggle(p.id);
      }}
    >
      <FocusIcon name={p.icon} />
      <span className="focus-button-label">{p.label}</span>
      {p.badge === undefined || p.badge === 0 ? null : (
        <span className="focus-badge" data-testid="chat-unread">
          {p.badge}
          <span className="smg-visually-hidden"> unread</span>
        </span>
      )}
    </button>
  );
}

export interface FocusBarProps {
  readonly state: RoundStateView;
  readonly now: number;
  // The special's sentence, in the game's words where it has its own (T119).
  readonly rule: string;
  readonly panels: Panels;
  readonly chat: boolean;
  readonly unread: number;
  readonly host: boolean;
  readonly fullscreen: Fullscreen;
}

export function FocusBar(p: FocusBarProps): ReactElement {
  const { state, panels, fullscreen } = p;
  const time = timeText(state, p.now);
  return (
    <header className="focus-bar" data-testid="round-banner">
      <SeasonPill state={state} rule={p.rule} />
      <span className="focus-fact focus-mode-fact">
        {state.secretMode === 'shared' ? 'Shared' : 'Individual'}
      </span>
      <span className="focus-facts">
        <span className="focus-fact" data-testid="round-cooldown">
          Wait {seconds(state.cooldownMs)}
        </span>
        {time === null ? null : (
          <span className="focus-fact focus-fact-time" data-testid="countdown">
            {time} left
          </span>
        )}
      </span>
      <span className="focus-actions">
        {p.chat ? (
          <PanelButton
            id="chat"
            panels={panels}
            icon="chat"
            label="Chat"
            testId="focus-chat"
            badge={p.unread}
          />
        ) : null}
        <PanelButton
          id="players"
          panels={panels}
          icon="players"
          label="Players"
          testId="focus-players"
        />
        {p.host ? (
          <PanelButton id="host" panels={panels} icon="host" label="Host" testId="host-menu" />
        ) : null}
        {fullscreen.supported ? (
          <button
            type="button"
            className="smg-btn focus-button"
            aria-pressed={fullscreen.on}
            data-testid="focus-fullscreen"
            onClick={fullscreen.toggle}
          >
            <FocusIcon name={fullscreen.on ? 'shrink' : 'expand'} />
            <span className="focus-button-label">
              {fullscreen.on ? 'Leave full screen' : 'Full screen'}
            </span>
          </button>
        ) : null}
      </span>
    </header>
  );
}
