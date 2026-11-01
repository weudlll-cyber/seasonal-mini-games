/**
 * @file   apps/web/src/round/RoundScreen.tsx
 * @module web/round
 * @brief  A running round on one screen: top bar, range and the one guess list, teams, input.
 *
 * Responsibility: the round view everyone gets alike, the host included (O16): during the
 *                 countdown the intro screen (./RoundIntro, O36); once open a one-line top
 *                 bar (season chip in its token colour with icon and the special's name, an
 *                 info button with what the special does (./SpecialInfo, O35), the halving
 *                 badge, shared or individual, the cooldown, the time left, and the host menu
 *                 for the host); the game's range block (the player panel for a roster
 *                 player, else the spectator panel), at the top of the side column on a
 *                 desktop and above the list on a phone; the main area with the special's
 *                 banner when it fires (./SpecialBanner, O35) and the round's one list of
 *                 guesses and events (./RoundLog, O20), as tall as the screen allows (O35);
 *                 the side column with, under the range, the team tiles and the match chat
 *                 (./RoundChat; a panel over the round on a phone); and for a roster player the game's input row with
 *                 the cooldown ring, whose platform refusals appear under it in plain words, or
 *                 once they solved their number a short notice with their place, their own
 *                 rows staying in the list (O25). The layout (round.css) fits the viewport
 *                 without a page scrollbar; only the lists scroll inside themselves. After the
 *                 end the result screen takes over.
 * Depends on:     react, @smg/contracts, @smg-game/registry/web, ../live/*, ../season/*,
 *                 ./CooldownRing, ./RoundChat, ./RoundIntro, ./RoundLog, ./RoundSide,
 *                 ./ResultScreen, ./SpecialBanner, ./SpecialInfo, ./roundText, ./round.css
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
import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASON_NAMES, seasonColor, SPECIALS } from '../season/season.js';
import { CooldownRing } from './CooldownRing.js';
import { ResultScreen } from './ResultScreen.js';
import { RoundChat } from './RoundChat.js';
import { RoundIntro } from './RoundIntro.js';
import { RoundLog } from './RoundLog.js';
import { TeamTiles } from './RoundSide.js';
import { SpecialBanner } from './SpecialBanner.js';
import { SpecialInfo } from './SpecialInfo.js';
import { codeText, seconds, solvedText } from './roundText.js';
import './round.css';

interface RoundScreenProps {
  readonly live: RoundLive;
  readonly gameId: string;
  readonly viewerKey: string | null;
  // The host menu for the host, else null.
  readonly hostMenu: ReactNode;
  readonly teamPoints: readonly { readonly team: TeamName; readonly points: number }[];
  // The match's player standings, for the result screen.
  readonly standings: readonly MatchStandingView[];
  // The match's chat panel, under the team tiles (./RoundChat), or null without a chat.
  readonly chat: ReactNode;
}

// The time left of an open round, "9:30" (the countdown is the intro screen's).
function timeText(state: RoundStateView, now: number): string {
  if (state.status !== 'open' || state.endsAt === null) return '';
  const left = Math.max(0, state.endsAt - now);
  const secs = Math.floor((left % 60_000) / 1_000);
  return `${String(Math.floor(left / 60_000))}:${String(secs).padStart(2, '0')}`;
}

function TopBar(p: {
  readonly state: RoundStateView;
  readonly now: number;
  readonly hostMenu: ReactNode;
}): ReactElement {
  const { state } = p;
  return (
    <header className="round-top" data-testid="round-banner">
      <span className="round-season" data-season={state.season}>
        {/* On a light disc: the token icon would vanish on its own season colour. */}
        <span className="round-season-icon">
          <SeasonIcon season={state.season} size="1.25rem" />
        </span>
        {/* On a phone the season's name stays and the special's goes to screen readers: the
            info button beside the chip names it and says what it does. */}
        <span className="round-season-text">
          <strong className="round-season-name" data-testid="round-season">
            {SEASON_NAMES[state.season]}{' '}
          </strong>
          <span className="round-special" data-testid="round-special">
            {state.specialOn ? SPECIALS[state.season].name : 'no special'}
          </span>
        </span>
        {state.halving ? <span className="round-badge">Halving round</span> : null}
      </span>
      {state.specialOn ? <SpecialInfo season={state.season} /> : null}
      <span className="round-fact round-mode">
        {state.secretMode === 'shared' ? 'Shared' : 'Individual'}
      </span>
      <span className="round-fact" data-testid="round-cooldown">
        <span className="round-fact-label">Cooldown </span>
        {seconds(state.cooldownMs)}
      </span>
      <span className="round-fact" data-testid="countdown">
        {timeText(state, p.now)}
        {/* A phone shows "9:30"; screen readers always hear "left". */}
        <span className="round-fact-label"> left</span>
      </span>
      {p.hostMenu}
    </header>
  );
}

interface PlayProps {
  readonly state: RoundStateView;
  readonly game: GameWeb;
  readonly viewerKey: string | null;
  readonly now: number;
  readonly reload: () => Promise<void>;
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
    />
  );
}

export function RoundScreen(props: RoundScreenProps): ReactElement {
  const { state, feed } = props.live;
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
  const style = { '--season': seasonColor(state.season) } as CSSProperties;
  if (state.status === 'countdown') {
    return (
      <div className="round-live round-live--intro" style={style} data-testid="round-view">
        <RoundIntro state={state} game={game} now={now} hostMenu={props.hostMenu} />
      </div>
    );
  }
  const player = state.role === 'player' && game !== null;
  return (
    <div className="round-live" style={style} data-testid="round-view">
      <TopBar state={state} now={now} hostMenu={props.hostMenu} />
      <div className="smg-panel round-range">
        <GamePart state={state} game={game} />
      </div>
      <section className="smg-panel round-main" aria-label="The round">
        <SpecialBanner feed={feed} state={state} game={game} now={now} />
        <RoundLog feed={feed} game={game} state={state} viewerKey={props.viewerKey} now={now} />
      </section>
      <aside className="round-side">
        <TeamTiles state={state} points={props.teamPoints} />
        <RoundChat chat={props.chat} />
      </aside>
      {player ? (
        <InputRow
          state={state}
          game={game}
          viewerKey={props.viewerKey}
          now={now}
          reload={props.live.reload}
        />
      ) : null}
    </div>
  );
}
