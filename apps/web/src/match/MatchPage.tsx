/**
 * @file   apps/web/src/match/MatchPage.tsx
 * @module web/match
 * @brief  One match: its players and teams, joining and leaving, the host's console and the round.
 *
 * Responsibility: from the countdown to the end, the round view alone, filling the screen
 *                 (O16: the host gets the same view and plays along; the host menu sits in its
 *                 top bar). Otherwise the match lobby of 02 §2: title, code and status with the
 *                 host menu; join or leave; the last round's result, if any; and the waiting
 *                 area with the team picker and the players (./WaitingArea, O23), also while
 *                 the next round is only set up. A player who joins during a round watches it
 *                 and plays from the next one. The host's last round settings are kept here,
 *                 so the next round's form is prefilled whichever layout made them.
 * Depends on:     react, @smg/contracts, ../live/*, ../shell/*, ./HostMenu, ./WaitingArea,
 *                 ../round/RoundScreen, ../round/roundText, ./match.css
 * Used by:        ../shell/AppShell
 * Spec:           docs/spec/02-game-guess-the-number.md §2, §4, §11; docs/spec/03-seasonal-specials.md §5
 */
import type { MatchDetailsView } from '@smg/contracts';
import { useState, type ReactElement } from 'react';

import { useMatch } from '../live/useMatch.js';
import { useRound, type RoundLive } from '../live/useRound.js';
import { codeText } from '../round/roundText.js';
import { RoundScreen } from '../round/RoundScreen.js';
import { api, ApiError } from '../shell/http.js';
import { useSession } from '../shell/session.js';
import { HostMenu, type Values } from './HostMenu.js';
import { WaitingArea } from './WaitingArea.js';
import './match.css';

function JoinLeave({
  match,
  reload,
}: {
  readonly match: MatchDetailsView;
  readonly reload: () => void;
}): ReactElement | null {
  const { can } = useSession();
  const [problem, setProblem] = useState<string | null>(null);
  if (
    match.youHost ||
    !can('match.join') ||
    match.status === 'closed' ||
    match.status === 'aborted'
  )
    return null;
  const go = async (what: 'join' | 'leave'): Promise<void> => {
    try {
      await api(`/matches/${match.code}/${what}`, { method: 'POST', body: {} });
      setProblem(null);
    } catch (error) {
      setProblem(error instanceof ApiError ? codeText(error.code) : 'That did not work.');
    }
    reload();
  };
  return (
    <div className="smg-row">
      {match.youPlayer ? (
        <button type="button" className="smg-btn" onClick={() => void go('leave')}>
          Leave match
        </button>
      ) : (
        <button
          type="button"
          className="smg-btn smg-btn--primary"
          onClick={() => void go('join')}
          data-testid="join"
        >
          Join match
        </button>
      )}
      {problem === null ? null : (
        <p role="alert" className="round-refusal">
          {problem}
        </p>
      )}
    </div>
  );
}

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
  if (missing)
    return (
      <section className="smg-panel">
        <h1>No such match</h1>
        <p>Check the code and try again.</p>
      </section>
    );
  if (match === null) return <p className="smg-muted">Loading the match…</p>;
  return <MatchView match={match} live={live} reload={reload} />;
}

// The round view alone while a round runs, else the lobby with the last result and the
// waiting area.
function MatchView(p: {
  readonly match: MatchDetailsView;
  readonly live: RoundLive;
  readonly reload: () => Promise<void>;
}): ReactElement {
  const { match, live } = p;
  const viewer = useSession().session?.account?.id ?? null;
  const [last, setLast] = useState<Values | null>(null);
  const refresh = (): void => {
    void p.reload();
    void live.reload();
  };
  const status = live.state?.status ?? null;
  const hostMenu = (
    <HostMenu match={match} roundStatus={status} reload={refresh} last={last} setLast={setLast} />
  );
  const phase = phaseOf(match, status);
  const round =
    phase !== 'live' && phase !== 'after' ? null : (
      <RoundScreen
        live={live}
        gameId={match.gameId}
        viewerKey={viewer}
        hostMenu={hostMenu}
        teamPoints={match.teamStandings}
      />
    );
  if (phase === 'live') {
    return (
      <div className="match-live" data-testid="match">
        {round}
      </div>
    );
  }
  if (phase === 'loading') {
    return (
      <p className="smg-muted" data-testid="match">
        Loading the round…
      </p>
    );
  }
  return (
    <LobbyView
      match={match}
      viewerKey={viewer}
      refresh={refresh}
      hostMenu={hostMenu}
      round={round}
    />
  );
}

// Before and between rounds: the match head with the host menu, joining, then the last
// result with the waiting area beside it on a wide screen and under it on a phone (T79).
function LobbyView(p: {
  readonly match: MatchDetailsView;
  readonly viewerKey: string | null;
  readonly refresh: () => void;
  readonly hostMenu: ReactElement;
  readonly round: ReactElement | null;
}): ReactElement {
  const { match } = p;
  const waiting = (
    <WaitingArea
      match={match}
      viewerKey={p.viewerKey}
      after={p.round !== null}
      reload={p.refresh}
    />
  );
  return (
    <div className="smg-stack" data-testid="match">
      <header className="match-head">
        <h1>{match.title}</h1>
        <span className="smg-chip">
          Code {match.code} · {match.status}
        </span>
        {p.hostMenu}
      </header>
      <JoinLeave match={match} reload={p.refresh} />
      {p.round === null ? (
        waiting
      ) : (
        <div className="match-after">
          {p.round}
          {waiting}
        </div>
      )}
    </div>
  );
}
