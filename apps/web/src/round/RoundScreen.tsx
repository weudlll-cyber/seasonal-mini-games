/**
 * @file   apps/web/src/round/RoundScreen.tsx
 * @module web/round
 * @brief  A running round in focus mode: the game's stage, its panel and the one guess list.
 *
 * Responsibility: the round view everyone gets alike, the host included (O16), inside the
 *                 focus mode (./FocusShell, O46: the slim bar, the panels on demand, full
 *                 screen): during the countdown the intro screen (./RoundIntro, O36); once
 *                 open the game's own panel (range, hint, fallen numbers or digits; a
 *                 spectator's panel) in the right column, the special's banner
 *                 (./SpecialBanner, O35) over the round's one list of guesses and events
 *                 (./RoundLog, O20) in the main area, and a roster player's input row (the
 *                 game's input with the cooldown ring, the platform's refusals under it in
 *                 plain words, or once they solved a short notice with their place, O25) at
 *                 its bottom (O50). A board game (Seasonal Target) gets the stage, the left
 *                 column at full height, for its board (the input's `stage` box), with panel,
 *                 list and input row in the right column (O51). On a phone the list holds the
 *                 guesses only, with "All (N)" for the whole list as a sheet (O49). The layout
 *                 (round.css) fits the viewport without a page scrollbar; only the lists
 *                 scroll inside themselves. After the end the result screen takes over,
 *                 outside focus mode (T128).
 * Depends on:     react, @smg/contracts, @smg-game/registry/web, ../live/*, ../season/*,
 *                 ../useMediaQuery, ./FocusPanel, ./FocusShell, ./InputRow, ./RoundIntro,
 *                 ./RoundLog, ./RoundSide, ./ResultScreen, ./SeasonPill, ./SpecialBanner,
 *                 ./roundText, ./usePanels, ./round.css
 * Used by:        ../match/MatchPage
 * Spec:           docs/spec/02-game-guess-the-number.md §4, §7, §11, §12; docs/spec/03-seasonal-specials.md §2, §6
 */
import { GAME_SCREENS, type GameWeb } from '@smg-game/registry/web';
import type { MatchStandingView, RoundStateView, TeamName } from '@smg/contracts';
import { useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';

import { serverNow } from '../live/socket.js';
import type { RoundLive } from '../live/useRound.js';
import { useTicker } from '../live/useTicker.js';
import { seasonColor } from '../season/season.js';
import { useNarrow } from '../useMediaQuery.js';
import { FocusPanel } from './FocusPanel.js';
import { FocusShell } from './FocusShell.js';
import { InputRow } from './InputRow.js';
import { ResultScreen } from './ResultScreen.js';
import { RoundIntro } from './RoundIntro.js';
import { RoundLog } from './RoundLog.js';
import { colorsOf } from './RoundSide.js';
import { ruleOf } from './SeasonPill.js';
import { bannerOf, SpecialBanner } from './SpecialBanner.js';
import type { Panels } from './usePanels.js';
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
}

// The game's part of the main area: a roster player's range block, or the spectator's.
function GamePart(p: { readonly state: RoundStateView; readonly game: GameWeb | null }) {
  const { state, game } = p;
  if (game === null || state.game === null) {
    return <p className="smg-muted">The round starts soon.</p>;
  }
  if (state.role !== 'player') {
    return (
      <game.Spectator
        view={state.game}
        names={state.names}
        colors={colorsOf(state)}
        season={state.season}
        specialOn={state.specialOn}
      />
    );
  }
  // The main area only shows; guesses go through the input row.
  return (
    <game.Player
      view={state.game}
      act={() => Promise.resolve({ ok: false })}
      canAct={false}
      frostDelayMs={state.frostDelayMs}
      now={serverNow}
      season={state.season}
      specialOn={state.specialOn}
      waitS={null}
      names={state.names}
      colors={colorsOf(state)}
    />
  );
}

interface ViewProps {
  readonly live: RoundLive;
  readonly state: RoundStateView;
  readonly game: GameWeb | null;
  readonly viewerKey: string | null;
  readonly now: number;
  readonly panels: Panels;
}

// The banner and the round's one list in the main area; on a phone the list holds the guesses
// and "All (N)" opens the whole list as a sheet (O49), a child of the round view's grid so it
// spans its rows down to the input row.
function ListPart(p: ViewProps): ReactElement {
  const { state, game, now, panels } = p;
  const narrow = useNarrow();
  const banner = bannerOf(p.live.feed, state, game, now);
  const log = { feed: p.live.feed, game, state, viewerKey: p.viewerKey, now };
  const more = {
    open: panels.open === 'list',
    toggle: () => {
      panels.toggle('list');
    },
    button: panels.button('list'),
  };
  return (
    <>
      <section className="smg-panel round-main" aria-label="The round">
        <SpecialBanner banner={banner} />
        <RoundLog {...log} hide={banner?.key ?? null} {...(narrow ? { more } : {})} />
      </section>
      {narrow ? (
        <FocusPanel
          title="Guesses and events"
          open={more.open}
          onClose={panels.close}
          testId="list-sheet"
        >
          <RoundLog {...log} />
        </FocusPanel>
      ) : null}
    </>
  );
}

// Where the game's parts go: a roster player's game (or null for a spectator), whether it is
// a board game, and what the right column's panel shows (null: a board game's spectator,
// who watches on the stage).
function partsOf(state: RoundStateView, game: GameWeb | null) {
  const playing = state.role === 'player' && game !== null ? game : null;
  const board = game?.layout === 'board';
  const watching = playing === null ? <GamePart state={state} game={game} /> : null;
  const panel =
    playing !== null ? <GamePart state={state} game={playing} /> : board ? null : watching;
  return { playing, board, watching, panel };
}

// An open round in focus mode: the game's panel in the right column (a spectator's there too,
// or on a board game's stage), the banner and the list in the main area, a roster player's
// input row under it; a board game's board on the stage (O50, O51).
function PlayView(p: ViewProps): ReactElement {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const { playing, board, watching, panel } = partsOf(p.state, p.game);
  return (
    <>
      {panel === null ? null : <div className="smg-panel round-range">{panel}</div>}
      <ListPart {...p} />
      {board ? (
        <div className="round-stage" ref={setStage}>
          {watching}
        </div>
      ) : null}
      {/* The board game's input waits for its stage, so the board never draws in the column. */}
      {playing === null || (board && stage === null) ? null : (
        <InputRow
          state={p.state}
          game={playing}
          viewerKey={p.viewerKey}
          now={p.now}
          reload={p.live.reload}
          stage={board ? stage : null}
        />
      )}
    </>
  );
}

export function RoundScreen(props: RoundScreenProps): ReactElement {
  const { state } = props.live;
  useTicker(state !== null && state.status !== 'ended' && state.status !== 'aborted');
  const game = GAME_SCREENS[props.gameId] ?? null;
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
  return (
    <FocusShell
      state={state}
      now={now}
      rule={ruleOf(game, state.season)}
      style={{ '--season': seasonColor(state.season) } as CSSProperties}
      layout={game?.layout ?? 'list'}
      viewerKey={props.viewerKey}
      teamPoints={props.teamPoints}
      chat={props.chat}
      host={props.host}
    >
      {(panels) =>
        state.status === 'countdown' ? (
          <RoundIntro state={state} game={game} now={now} />
        ) : (
          <PlayView
            state={state}
            game={game}
            viewerKey={props.viewerKey}
            now={now}
            live={props.live}
            panels={panels}
          />
        )
      }
    </FocusShell>
  );
}
