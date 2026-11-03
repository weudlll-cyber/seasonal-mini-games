/**
 * @file   apps/web/src/round/FocusShell.tsx
 * @module web/round
 * @brief  The focus mode around a running round: the slim bar, the panels on demand, full screen.
 *
 * Responsibility: from the countdown until the round ends (O46) the round view is this one
 *                 container: the app's header is hidden (../shell/shell.css), the bar
 *                 (./FocusBar) on top and the round's content under it; Chat (kept mounted, so
 *                 it keeps its room and what was typed, 07 §2), Players with the teams and,
 *                 for the host, the host's controls are panels on demand, one at a time
 *                 (./usePanels, ./FocusPanel). The chat's unread badge counts the messages of
 *                 others that arrive while the chat panel is closed (../chat/chatArrivals) and
 *                 clears when it opens. Full screen applies to this container, so the bar and
 *                 the panels stay inside it (./useFullscreen). The content gets the panels too,
 *                 for the whole list and the phone's game panel. The container carries the
 *                 layout, desktop or phone (`data-view`, T141).
 * Depends on:     react, @smg/contracts, ../chat/chatArrivals, ./FocusBar, ./FocusPanel,
 *                 ./RoundSide, ./useFullscreen, ./usePanels, ./useRoundView (type), ./focus.css
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/07-integration.md §2
 */
import type { RoundStateView, TeamName } from '@smg/contracts';
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';

import { ChatArrivals } from '../chat/chatArrivals.js';
import { FocusBar } from './FocusBar.js';
import { FocusPanel } from './FocusPanel.js';
import { PlayersPanelBody } from './RoundSide.js';
import { useFullscreen } from './useFullscreen.js';
import { usePanels, type PanelId, type Panels } from './usePanels.js';
import type { RoundView } from './useRoundView.js';
import './focus.css';

export interface FocusShellProps {
  readonly state: RoundStateView;
  readonly now: number;
  readonly rule: string;
  readonly view: RoundView;
  readonly style: CSSProperties;
  readonly layout: string;
  readonly viewerKey: string | null;
  readonly teamPoints: readonly { readonly team: TeamName; readonly points: number }[];
  // The match chat, or null without one (the provider `none`).
  readonly chat: ReactNode;
  // The host's controls in their panel, given its close; null for everyone but the host.
  readonly host: ((close: () => void) => ReactNode) | null;
  readonly children: (panels: Panels) => ReactNode;
}

// The unread count of the chat: counted while its panel is closed, cleared on opening it.
function useUnread(panels: Panels) {
  const [unread, setUnread] = useState(0);
  const open = useRef(panels.open);
  open.current = panels.open;
  const arrived = useCallback(() => {
    if (open.current !== 'chat') setUnread((n) => n + 1);
  }, []);
  const toggle = (id: PanelId): void => {
    if (id === 'chat') setUnread(0);
    panels.toggle(id);
  };
  return { unread, arrived, panels: { ...panels, toggle } };
}

// The three panels of the bar: the chat kept mounted, the players, the host's controls.
function BarPanels(p: FocusShellProps & { readonly panels: Panels }): ReactElement {
  const { panels } = p;
  const opened = (id: PanelId) => panels.open === id;
  return (
    <>
      {p.chat === null ? null : (
        <FocusPanel
          title="Chat"
          open={opened('chat')}
          onClose={panels.close}
          keep
          testId="chat-drawer"
        >
          {p.chat}
        </FocusPanel>
      )}
      <FocusPanel
        title="Players"
        open={opened('players')}
        onClose={panels.close}
        testId="players-drawer"
      >
        <PlayersPanelBody state={p.state} points={p.teamPoints} viewerKey={p.viewerKey} />
      </FocusPanel>
      {p.host === null ? null : (
        <FocusPanel title="Host" open={opened('host')} onClose={panels.close} testId="host-drawer">
          {p.host(panels.close)}
        </FocusPanel>
      )}
    </>
  );
}

export function FocusShell(p: FocusShellProps): ReactElement {
  const box = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(box);
  const { unread, arrived, panels } = useUnread(usePanels());
  return (
    <ChatArrivals.Provider value={arrived}>
      <div
        ref={box}
        className="round-live"
        style={p.style}
        data-testid="round-view"
        data-layout={p.layout}
        // Desktop or phone (./useRoundView, T141): ./round.css lays the round out by it.
        data-view={p.view}
        data-status={p.state.status}
        // The open panel: on a desktop its column pushes the game aside (./round.css, O48).
        data-panel={panels.open ?? undefined}
        onKeyDown={(e) => {
          // Escape from the bar closes the open panel too, not only from inside it.
          if (e.key === 'Escape' && panels.open !== null) panels.close();
        }}
      >
        <FocusBar
          state={p.state}
          now={p.now}
          rule={p.rule}
          phone={p.view === 'phone'}
          panels={panels}
          chat={p.chat !== null}
          unread={unread}
          host={p.host !== null}
          fullscreen={fullscreen}
        />
        {p.children(panels)}
        <BarPanels {...p} panels={panels} />
      </div>
    </ChatArrivals.Provider>
  );
}
