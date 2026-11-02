/**
 * @file   apps/web/src/round/RoundScreen.tsx
 * @module web/round
 * @brief  A running round in focus mode: the game's stage, its panel and the one guess list.
 *
 * Responsibility: the round view everyone gets alike, the host included (O16), inside the
 *                 focus mode (./FocusShell, O46: the slim bar, the panels on demand, full
 *                 screen): during the countdown the intro screen (./RoundIntro, O36); once
 *                 open the stage, the space the game gets, with a roster player's input row
 *                 (the game's input with the cooldown ring, the platform's refusals under it in
 *                 plain words, or once they solved a short notice with their place, O25) or a
 *                 spectator's panel; and the right column of about 320 px on a desktop with
 *                 a roster player's game panel (range, fallen numbers or digits) on top and
 *                 the special's banner (./SpecialBanner, O35) over the round's one list of
 *                 guesses and events (./RoundLog, O20) under it; on a phone the game panel is
 *                 compact and the list shows its newest rows with "All (N)" for the whole list
 *                 as a sheet. The layout (round.css) fits the viewport without a page
 *                 scrollbar; only the lists scroll inside themselves. After the end the result
 *                 screen takes over, outside focus mode (T128).
 * Depends on:     react, @smg/contracts, @smg-game/registry/web, ../live/*, ../season/*,
 *                 ../useMediaQuery, ./CooldownRing, ./FocusPanel, ./FocusShell, ./RoundIntro,
 *                 ./RoundLog, ./RoundSide, ./ResultScreen, ./SeasonPill, ./SpecialBanner,
 *                 ./roundText, ./usePanels, ./round.css
 * Used by:        ../match/MatchPage
 * Spec:           docs/spec/02-game-guess-the-number.md §4, §7, §11, §12; docs/spec/03-seasonal-specials.md §2, §6
 */
import { GAME_SCREENS, type GameWeb } from '@smg-game/registry/web';
import type { MatchStandingView, RoundStateView, TeamName } from '@smg/contracts';
import type { ActReply } from '@smg/game-sdk';
import { useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';

import { intent, serverNow } from '../live/socket.js';
import type { RoundLive } from '../live/useRound.js';
import { useTicker } from '../live/useTicker.js';
import { seasonColor } from '../season/season.js';
import { useNarrow } from '../useMediaQuery.js';
import { CooldownRing } from './CooldownRing.js';
import { FocusPanel } from './FocusPanel.js';
import { FocusShell } from './FocusShell.js';
import { ResultScreen } from './ResultScreen.js';
import { RoundIntro } from './RoundIntro.js';
import { RoundLog } from './RoundLog.js';
import { colorsOf } from './RoundSide.js';
import { ruleOf } from './SeasonPill.js';
import { SpecialBanner } from './SpecialBanner.js';
import { codeText, solvedText } from './roundText.js';
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

interface PlayProps {
  readonly state: RoundStateView;
  readonly game: GameWeb;
  readonly viewerKey: string | null;
  readonly now: number;
  readonly reload: () => Promise<void>;
}

// Whole seconds left of the viewer's cooldown in an open round, else null (T125).
function waitOf(state: RoundStateView, endsAt: number, now: number): number | null {
  if (state.status !== 'open' || endsAt <= now) return null;
  return Math.ceil((endsAt - now) / 1_000);
}

// A roster player's input row with the ring, and the platform's refusals under it; once the
// player solved (individual mode), a short notice with their place instead (O25).
function InputRow({ state, game, viewerKey, now, reload }: PlayProps): ReactElement | null {
  const [refusal, setRefusal] = useState<string | null>(null);
  const me = state.roster.find((r) => r.playerKey === viewerKey) ?? null;
  if (me === null || state.game === null) return null;
  if (me.solved) {
    return (
      <p className="round-input round-solved" role="status" data-testid="solved-notice">
        {solvedText(me.place)}
      </p>
    );
  }
  const act = async (action: unknown): Promise<ActReply> => {
    const reply = await intent('guess', { roundId: state.roundId, ...(action as object) });
    // The game words its own refusals; the platform's are worded here.
    const own = reply.code === undefined ? null : game.text.code(reply.code);
    setRefusal(reply.ok || own !== null ? null : codeText(reply.code, reply.until, serverNow()));
    // The answer counts as arrived once the view holds the new cooldown: until then the old
    // one would show Guess enabled for a send the server refuses (T76).
    await reload().catch(() => undefined);
    return reply;
  };
  // The cooldown exists only while the round is open.
  const ring =
    state.status === 'open' ? (
      <CooldownRing endsAt={me.cooldownEndsAt} cooldownMs={state.cooldownMs} now={now} />
    ) : null;
  return (
    <div className="round-input">
      <game.Input
        view={state.game}
        act={act}
        canAct={state.status === 'open' && me.cooldownEndsAt <= now}
        frostDelayMs={state.frostDelayMs}
        now={serverNow}
        season={state.season}
        specialOn={state.specialOn}
        waitS={waitOf(state, me.cooldownEndsAt, now)}
        names={state.names}
        colors={colorsOf(state)}
        ring={ring}
      />
      {refusal === null ? null : (
        <p role="status" className="round-refusal">
          {refusal}
        </p>
      )}
    </div>
  );
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

// The round's one list: on a desktop the whole list in the right column; on a phone its
// newest rows with an "All (N)" button that opens the whole list as a sheet (O46).
function ListPart(p: {
  readonly live: RoundLive;
  readonly state: RoundStateView;
  readonly game: GameWeb | null;
  readonly viewerKey: string | null;
  readonly now: number;
  readonly panels: Panels;
}): ReactElement {
  const narrow = useNarrow();
  const { panels } = p;
  const log = {
    feed: p.live.feed,
    game: p.game,
    state: p.state,
    viewerKey: p.viewerKey,
    now: p.now,
  };
  if (!narrow) return <RoundLog {...log} />;
  const more = {
    open: panels.open === 'list',
    toggle: () => {
      panels.toggle('list');
    },
    button: panels.button('list'),
  };
  return (
    <>
      <RoundLog {...log} more={more} />
      <FocusPanel
        title="Guesses and events"
        open={more.open}
        onClose={panels.close}
        testId="list-sheet"
      >
        <RoundLog {...log} />
      </FocusPanel>
    </>
  );
}

// An open round in focus mode: a roster player's game panel at the top of the right column
// with the list under it, and their input row on the stage, the space the game gets; a
// spectator's panel takes the stage itself (O46).
function PlayView(p: {
  readonly live: RoundLive;
  readonly state: RoundStateView;
  readonly game: GameWeb | null;
  readonly viewerKey: string | null;
  readonly now: number;
  readonly panels: Panels;
}): ReactElement {
  const { state, game, now } = p;
  const playing = state.role === 'player' && game !== null ? game : null;
  return (
    <>
      {playing === null ? null : (
        <div className="smg-panel round-range">
          <GamePart state={state} game={playing} />
        </div>
      )}
      <section className="smg-panel round-main" aria-label="The round">
        <SpecialBanner feed={p.live.feed} state={state} game={game} now={now} />
        <ListPart {...p} />
      </section>
      <div className="round-stage">
        {playing === null ? (
          <GamePart state={state} game={game} />
        ) : (
          <InputRow
            state={state}
            game={playing}
            viewerKey={p.viewerKey}
            now={now}
            reload={p.live.reload}
          />
        )}
      </div>
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
