/**
 * @file   apps/web/src/match/MatchPage.tsx
 * @module web/match
 * @brief  One match: its players and teams, joining and leaving, the host's console and the round.
 *
 * Responsibility: from the countdown to the end, the round view alone in focus mode, filling
 *                 the screen without the app header (O46; O16: the host gets the same view and
 *                 plays along; the host's controls and the match chat are panels from its bar,
 *                 ../round/FocusShell). The result keeps the app header hidden: the slim
 *                 result bar (./ResultBar) over the result, the next round's box and the chat
 *                 beside it on a desktop and under it on a phone (T145, replacing T128), one
 *                 screen whose area under the bar scrolls, never the page (O111). A game
 *                 that docks its chat (O97, O109) has it under the round and the result instead
 *                 (./DockedMatch); with a result of its own (Seasonal Mind Games) the next
 *                 round's box is in that result, else the waiting area stays beside it.
 *                 Otherwise
 *                 the match lobby of 02 §2: title, the match's game (O41), code and status with
 *                 the host menu; join or
 *                 leave; the last round's result, if any; and the waiting area with the team
 *                 picker and the players (./WaitingArea, O23) with the match chat as a panel
 *                 of its own under it, on a phone behind a "Chat" button (07 §2, T116),
 *                 also while the next round is only set up. A player who joins during a round
 *                 watches it and plays from the next one. The host's last round settings are
 *                 kept here, so the next round's form is prefilled whichever layout made them;
 *                 without them, the last round's season and halving (T209) and its inactivity
 *                 limit and warning (O75, `keptOf`).
 *                 A closed or aborted match shows its summary (./MatchSummary, O27).
 * Depends on:     react, @smg/contracts, ../chat/*, ../live/*, ../shell/*, ./HostMenu,
 *                 ./MatchSummary, ./ResultBar, ./WaitingArea, ../round/RoundChat, ../round/RoundScreen,
 *                 ../round/roundText, ../lobby/games, ./match.css
 * Used by:        ../shell/AppShell
 * Spec:           docs/spec/02-game-guess-the-number.md §2, §4, §11; docs/spec/03-seasonal-specials.md §5
 */
import { GAME_SCREENS } from '@smg-game/registry/web';
import type { GameInfoView, MatchDetailsView } from '@smg/contracts';
import { useState, type ReactElement } from 'react';

import { ChatPanel } from '../chat/ChatPanel.js';
import { useChatConfig } from '../chat/useChat.js';
import { useMatch } from '../live/useMatch.js';
import { useRound, type RoundLive } from '../live/useRound.js';
import { RoundChat } from '../round/RoundChat.js';
import { chatBarOf, docksChat, gameName, useGameList, useGames } from '../lobby/games.js';
import { RoundScreen } from '../round/RoundScreen.js';
import { DockedMatch } from './DockedMatch.js';
import { HostConsole, HostMenu, hosts, type Values } from './HostMenu.js';
import { JoinLeave } from './JoinLeave.js';
import { roundPrefsOf, useOwnPart } from './GamePrefs.js';
import { MatchSummary } from './MatchSummary.js';
import { NextRound } from './NextRound.js';
import { ResultBar } from './ResultBar.js';
import { WaitingArea } from './WaitingArea.js';
import { keptOf } from './roundFields.js';
import './match.css';

// The round view takes the page from the countdown; a round only set up waits in the lobby.
const LIVE = new Set(['countdown', 'open']);
// A finished round's result stays above (or beside) the waiting area until the next one.
const DONE = new Set(['ended', 'aborted']);

type Phase = 'live' | 'loading' | 'after' | 'waiting';

// What the match page shows: the round view, "loading" while a round's view is on its way
// (no waiting area meanwhile), the last result with the waiting area, or the waiting area.
function phaseOf(match: MatchDetailsView, status: string | null): Phase {
  if (status === null) return match.round === null ? 'waiting' : 'loading';
  if (LIVE.has(status)) return 'live';
  return DONE.has(status) ? 'after' : 'waiting';
}

export function MatchPage({ code }: { readonly code: string }): ReactElement {
  const { match, missing, reload } = useMatch(code);
  const live = useRound(match?.round?.id ?? null);
  // Whether the game docks its chat decides the page's layout: shown only once that is known, so
  // the round view is not built a second time under a finger.
  const { settled } = useGameList();
  if (missing)
    return (
      <section className="sk-panel">
        <h1>No such match</h1>
        <p>Check the code and try again.</p>
      </section>
    );
  if (match === null || !settled) return <p className="smg-muted">Loading the match…</p>;
  // An ended match stays readable at its address as its summary (O27).
  if (match.ended !== null) return <MatchSummary match={match} viewerKey={match.you} />;
  return <MatchView match={match} live={live} reload={reload} />;
}

// The match's chat panel (bare: the screen gives it its place and heading), or null when the
// provider is `none` (07 §2).
function useMatchChat(code: string): ReactElement | null {
  const config = useChatConfig();
  if (config === null || config.provider === 'none') return null;
  return <ChatPanel target={{ kind: 'match', code }} config={config} bare />;
}

// The next round's form values: the host's last ones; before the host's form made a round here
// (a Quick Test's first round), the last round's (T209, O75).
const keptValues = (last: Values | null, live: RoundLive, gameId: string): Values | null =>
  last ?? (live.state === null ? null : keptOf(live.state, GAME_SCREENS[gameId]));

// The rounds a series has played (the one just ended, for the standings' title); null outside one.
const playedOf = (match: MatchDetailsView): number | null => match.series?.played ?? null;

// The docked page's next-round box under the result; its bar starts at the round's end.
const nextBox = (match: MatchDetailsView, live: RoundLive, reload: () => void) => (
  <NextRound match={match} since={live.state?.endedAt ?? null} reload={reload} />
);

// Where the chat sits in this phase. A game that docks its chat under the round (O97, O109) has
// one chat for the round and the result, with its phone bar's form; docked with a result of its
// own (Seasonal Mind Games) the next round's box is in the result instead of the waiting area
// beside it, while the platform's result (the list games, O109) keeps the waiting area beside
// it, the chat docked under both.
function chatPlace(games: readonly GameInfoView[], gameId: string, phase: Phase) {
  const docked = docksChat(games, gameId) && phase !== 'waiting';
  const ownAfter = docked && GAME_SCREENS[gameId]?.ownResult === true;
  return { docked, ownAfter, bar: chatBarOf(games, gameId) };
}

// The round view alone while a round runs, else the lobby with the last result and the
// waiting area.
function MatchView(p: {
  readonly match: MatchDetailsView;
  readonly live: RoundLive;
  readonly reload: () => Promise<void>;
}): ReactElement {
  const { match, live } = p;
  // The viewer's number in the match: every player key the page reads is one (T104).
  const viewer = match.you;
  const [last, setLast] = useState<Values | null>(null);
  const refresh = (): void => {
    void p.reload();
    void live.reload();
  };
  const status = live.state?.status ?? null;
  const chat = useMatchChat(match.code);
  const own = useOwnPart(match, p.reload);
  const kept = keptValues(last, live, match.gameId);
  const menu = { match, roundStatus: status, reload: refresh, last: kept, setLast };
  const hostMenu = <HostMenu {...menu} />;
  const phase = phaseOf(match, status);
  const { docked, ownAfter, bar } = chatPlace(useGames(), match.gameId, phase);
  // Mounted only by the phases that show a round (./PhaseBody: live and after).
  const round = (
    <RoundScreen
      live={live}
      gameId={match.gameId}
      viewerKey={viewer}
      host={hosts(match) ? (close) => <HostConsole {...menu} close={close} /> : null}
      teamPoints={match.teamStandings}
      standings={match.standings}
      // The chat is in the round view only while the round runs; after it, the waiting
      // area beside the result holds it (one room on the page at a time). Docked, it is
      // neither: ./DockedMatch holds it under both.
      chat={phase === 'live' && !docked ? chat : null}
      own={own}
      // A player's pre-picks for the later rounds, from the round bar (O117).
      prefs={roundPrefsOf(match, own)}
      // Docked with its own result, the next round's box goes beside the standings (O97).
      next={ownAfter ? nextBox(match, live, refresh) : undefined}
      roundNo={playedOf(match)}
    />
  );
  const lobby = { match, viewerKey: viewer, refresh, hostMenu, chat: docked ? null : chat };
  if (phase === 'waiting') return <LobbyView {...lobby} />;
  const body = (
    <PhaseBody {...lobby} phase={phase} docked={docked} ownAfter={ownAfter} round={round} />
  );
  return docked ? (
    <DockedMatch phase={phase} chat={chat} bar={bar}>
      {body}
    </DockedMatch>
  ) : (
    body
  );
}

// The page in a phase other than waiting. The page's one test id and the focus mode's class
// go on its outermost box, ./DockedMatch's when docked (the loading line is in no focus mode).
function PhaseBody(
  p: LobbyProps & {
    readonly phase: 'live' | 'loading' | 'after';
    readonly docked: boolean;
    readonly ownAfter: boolean;
    readonly round: ReactElement;
  },
): ReactElement {
  const outer = (className: string, focus = true) =>
    p.docked
      ? { className }
      : { className: focus ? `${className} focus-mode` : className, 'data-testid': 'match' };
  // A running round in focus mode: one screen, no app header (O46, T128).
  if (p.phase === 'live') {
    return <div {...outer(p.docked ? 'match-live' : 'match-live one-screen')}>{p.round}</div>;
  }
  if (p.phase === 'loading') return <p {...outer('smg-muted', false)}>Loading the round…</p>;
  // The result is one screen too (O111): the page never scrolls, its area under the bar does.
  return (
    <AfterView
      {...p}
      outer={outer(p.docked ? 'match-result-page' : 'match-result-page one-screen')}
    />
  );
}

interface LobbyProps {
  readonly match: MatchDetailsView;
  readonly viewerKey: string | null;
  readonly refresh: () => void;
  readonly hostMenu: ReactElement;
  // The match chat, a panel under the waiting area (07 §2), or null without a chat.
  readonly chat: ReactElement | null;
}

// "Before the round" or "Next round" with the players, and under it the chat as a panel of
// its own (on a phone behind its "Chat" button, ../round/RoundChat, T116).
function Side(p: LobbyProps & { readonly after: boolean }): ReactElement {
  return (
    <div className="match-side">
      <JoinLeave match={p.match} reload={p.refresh} />
      <WaitingArea match={p.match} viewerKey={p.viewerKey} after={p.after} reload={p.refresh} />
      <RoundChat chat={p.chat} />
    </div>
  );
}

// A finished round: the slim bar instead of the app header (T145), the result's first part
// on one screen, the next round's box and the chat beside it on a desktop, under it on a
// phone, where the page scrolls.
function AfterView(
  p: LobbyProps & {
    readonly round: ReactElement | null;
    // The box's class and, outside the docked page, the page's test id.
    readonly outer: { readonly className: string };
    // Docked with the game's own result (O97): no column beside it; its next-round box is in
    // the result. Otherwise the waiting area beside it, without the chat when it is docked.
    readonly ownAfter: boolean;
  },
): ReactElement {
  const games = useGames();
  return (
    <div {...p.outer}>
      <ResultBar
        title={p.match.title}
        game={gameName(games, p.match.gameId)}
        code={p.match.code}
        host={p.hostMenu}
      />
      <div className={p.ownAfter ? 'match-after match-after--docked' : 'match-after'}>
        {p.round}
        {p.ownAfter ? null : <Side {...p} after />}
      </div>
    </div>
  );
}

// Before the first round and while the next is set up: the match head with the host menu,
// then the waiting area with joining and the chat (T79, T116).
function LobbyView(p: LobbyProps): ReactElement {
  const { match } = p;
  const games = useGames();
  return (
    <div className="smg-stack" data-testid="match">
      <header className="match-head">
        <h1>{match.title}</h1>
        <span className="sk-chip" data-testid="match-game">
          {gameName(games, match.gameId)}
        </span>
        <span className="sk-chip">
          Code {match.code} · {match.status}
        </span>
        {p.hostMenu}
      </header>
      <Side {...p} after={false} />
    </div>
  );
}
