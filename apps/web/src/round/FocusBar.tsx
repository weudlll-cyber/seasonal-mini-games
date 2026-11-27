/**
 * @file   apps/web/src/round/FocusBar.tsx
 * @module web/round
 * @brief  The focus mode's one slim game bar over a running round (O46): the kit's `GameBar`.
 *
 * Responsibility: the game's parts of the bar, given to the kit's `GameBar` (the bar's row, its
 *                 buttons, the full-screen toggle and the way back are the kit's): the season
 *                 pill as its lead part (./SeasonPill, on a phone with the special's note; a
 *                 desktop has the special's line in the info column, T141), shared or
 *                 individual as a desktop-only fact (only in a game with a secret, T347),
 *                 "9:50 left" once the round is open (the countdown's seconds are the intro's;
 *                 a phased round's counts to the plan's end and then says "Result in 0:04",
 *                 ./roundText, T386), and the panel buttons on demand (./panels, the kit's
 *                 usePanels): Chat with the unread count (only with a chat, the provider not
 *                 `none`), Players with the teams, Pre-picks (a phased game's player, O117;
 *                 the kit's 'prefs' icon), Host (the host only). In website mode the bar
 *                 starts with the way back to the website (the kit's BackLink, GAME-INTEGRATION
 *                 §8, O148; the arrow alone on a phone). The waiting
 *                 time is not here: the cooldown ring and the disabled button at the input
 *                 show it (O47). Each button names itself; a phone shows the icons and reads
 *                 the words out. The season pill, the mode fact, `barTime` and the panel ids
 *                 stay the game's.
 * Depends on:     react, @seasonal/kit/react (GameBar, Fullscreen, type), @smg/contracts,
 *                 ../shell/session (useWebsiteMode), ./roundText, ./SeasonPill, ./panels
 * Used by:        ./FocusShell
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §6
 */
import { GameBar, type BarAction, type BarFact, type Fullscreen } from '@seasonal/kit/react';
import type { RoundStateView } from '@smg/contracts';
import type { ReactElement } from 'react';

import { useWebsiteMode } from '../shell/session.js';
import type { PanelId, Panels } from './panels.js';
import { barTime } from './roundText.js';
import { SeasonPill } from './SeasonPill.js';

interface FocusBarProps {
  readonly state: RoundStateView;
  readonly now: number;
  // The special's sentence, in the game's words where it has its own (T119).
  readonly rule: string;
  // False in a game that shows no season: no pill (O93).
  readonly season: boolean;
  // False in a game without a secret: no "Shared" or "Individual" (T347).
  readonly mode: boolean;
  // A phone: the pill is the special's button with its note; a desktop's info column has the
  // special's line instead (T141).
  readonly phone: boolean;
  readonly panels: Panels;
  readonly chat: boolean;
  readonly unread: number;
  readonly host: boolean;
  // A player of a phased game with pre-picks: the later rounds' picks in their panel (O117).
  readonly prefs: boolean;
  readonly fullscreen: Fullscreen;
}

// The panel buttons, in the bar's order; each only where the round has that panel.
function actionsOf(p: FocusBarProps): readonly BarAction<PanelId>[] {
  const all: readonly (BarAction<PanelId> | null)[] = [
    p.chat
      ? { id: 'chat', icon: 'chat', label: 'Chat', testId: 'focus-chat', badge: p.unread }
      : null,
    { id: 'players', icon: 'players', label: 'Players', testId: 'focus-players' },
    p.prefs ? { id: 'prefs', icon: 'prefs', label: 'Pre-picks', testId: 'focus-prefs' } : null,
    p.host ? { id: 'host', icon: 'host', label: 'Host', testId: 'host-menu' } : null,
  ];
  return all.filter((action) => action !== null);
}

export function FocusBar(p: FocusBarProps): ReactElement {
  const { state } = p;
  const website = useWebsiteMode();
  const facts: readonly BarFact[] = p.mode
    ? [{ text: state.secretMode === 'shared' ? 'Shared' : 'Individual', desktopOnly: true }]
    : [];
  return (
    <GameBar
      back={{ websiteMode: website }}
      lead={p.season ? <SeasonPill state={state} rule={p.rule} note={p.phone} /> : undefined}
      facts={facts}
      time={barTime(state, p.now)}
      actions={actionsOf(p)}
      panels={p.panels}
      fullscreen={p.fullscreen}
      buttonClassName="sk-btn"
    />
  );
}
