/**
 * @file   apps/web/src/round/RoundScreen.tsx
 * @module web/round
 * @brief  A running round in focus mode: the intro, then the round's body in one of two layouts.
 *
 * Responsibility: the round view everyone gets alike, the host included (O16), inside the
 *                 focus mode (./FocusShell, O46: the slim bar, the panels on demand, full
 *                 screen): during the countdown the intro screen (./RoundIntro, O36); once
 *                 open the round's body (./RoundBody) in the layout the viewport gets, desktop
 *                 or phone (./useRoundView, T141), with only what matters for the next guess
 *                 (O54). The layout (./round.css) fits the viewport without a page scrollbar;
 *                 only the lists scroll inside themselves. The viewer's own colour is set
 *                 here for the list's own rows and a board game's own tiles. After the end the
 *                 result screen takes over, outside focus mode (T128).
 * Depends on:     react, @smg/contracts, @smg-game/registry/web, ../live/*, ../season/*,
 *                 ./FocusShell, ./ResultScreen, ./RoundBody, ./RoundIntro, ./RoundSide,
 *                 ./SeasonPill, ./useRoundView, ./round.css
 * Used by:        ../match/MatchPage
 * Spec:           docs/spec/02-game-guess-the-number.md §4, §7, §11, §12; docs/spec/03-seasonal-specials.md §2, §6
 */
import { GAME_SCREENS } from '@smg-game/registry/web';
import type { MatchStandingView, RoundStateView, TeamName } from '@smg/contracts';
import type { OwnMatchPart } from '@smg/game-sdk';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { serverNow } from '../live/socket.js';
import type { RoundLive } from '../live/useRound.js';
import { useTicker } from '../live/useTicker.js';
import { useSeasonless } from '../lobby/games.js';
import { seasonColor } from '../season/season.js';
import { FocusShell } from './FocusShell.js';
import { ResultScreen } from './ResultScreen.js';
import { RoundBody } from './RoundBody.js';
import { RoundIntro } from './RoundIntro.js';
import { playerColor } from './RoundSide.js';
import { ruleOf } from './SeasonPill.js';
import { useRoundView } from './useRoundView.js';
import { roundMarks } from './playerMarks.js';
import './round.css';

interface RoundScreenProps {
  readonly live: RoundLive;
  readonly gameId: string;
  readonly viewerKey: string | null;
  // The host's controls in the focus mode's Host panel, given its close; null for others.
  readonly host: ((close: () => void) => ReactNode) | null;
  readonly teamPoints: readonly { readonly team: TeamName; readonly points: number }[];
  // The match's player standings, for the result screen.
  readonly standings: readonly MatchStandingView[];
  // The match's chat, a panel from the round bar (./FocusShell), or null without a chat.
  readonly chat: ReactNode;
  // A phased game's: the viewer's own part of the match, for their input (T327).
  readonly own?: OwnMatchPart | undefined;
}

// The season's colour (a neutral one in a game that shows no season, O93), and the viewer's
// own colour as their dot's (their team's, or their roster colour): own rows and a board
// game's own tiles take it, so the list and the board agree (night 6).
const screenStyle = (state: RoundStateView, viewerKey: string | null, season: boolean) =>
  ({
    '--season': season ? seasonColor(state.season) : 'var(--color-border-strong)',
    '--own': viewerKey === null ? undefined : playerColor(state, viewerKey),
  }) as CSSProperties;

export function RoundScreen(props: RoundScreenProps): ReactElement {
  const { state } = props.live;
  const view = useRoundView();
  useTicker(state !== null && state.status !== 'ended' && state.status !== 'aborted');
  const game = GAME_SCREENS[props.gameId] ?? null;
  // A game whose rounds show no season names itself instead (O93).
  const noSeason = useSeasonless(props.gameId);
  const season = noSeason === null;
  if (state === null) return <p className="smg-muted">Loading the round…</p>;
  if (state.status === 'ended') {
    return (
      <ResultScreen
        state={state}
        game={game}
        viewerKey={props.viewerKey}
        standings={props.standings}
      />
    );
  }
  if (state.status === 'aborted') {
    return <p className="smg-panel">The round was aborted: {state.abortReason}</p>;
  }
  const now = serverNow();
  const rule = ruleOf(game, state.season);
  return (
    <FocusShell
      state={state}
      now={now}
      rule={rule}
      view={view}
      style={screenStyle(state, props.viewerKey, season)}
      season={season}
      layout={game?.layout ?? 'list'}
      viewerKey={props.viewerKey}
      marks={roundMarks(state, game, props.viewerKey)}
      teamPoints={props.teamPoints}
      chat={props.chat}
      host={props.host}
    >
      {(panels) =>
        state.status === 'countdown' ? (
          <RoundIntro state={state} game={game} now={now} noSeason={noSeason} />
        ) : (
          <RoundBody
            state={state}
            game={game}
            viewerKey={props.viewerKey}
            now={now}
            live={props.live}
            panels={panels}
            phone={view === 'phone'}
            rule={rule}
            own={props.own}
          />
        )
      }
    </FocusShell>
  );
}
