/**
 * @file   apps/web/src/match/MatchPage.tsx
 * @module web/match
 * @brief  One match: its players and teams, joining and leaving, the host's console and the round.
 *
 * Responsibility: while a round runs, the round view alone, filling the screen (O16: the host
 *                 gets the same view and plays along; the host menu sits in its top bar).
 *                 Otherwise the match lobby of 02 §2: title, code and status with the host
 *                 menu; join or leave; the season team picker (03 §5); the players with their
 *                 teams; and the last round's result. A player who joins during a round
 *                 watches it and plays from the next one. The host's last round settings are
 *                 kept here, so the next round's form is prefilled whichever layout made them.
 * Depends on:     react, @smg/contracts, @smg/game-sdk (types), ../live/*, ../shell/*,
 *                 ../season/*, ./HostMenu, ../round/RoundScreen, ../round/roundText, ./match.css
 * Used by:        ../shell/AppShell
 * Spec:           docs/spec/02-game-guess-the-number.md §2, §4, §11; docs/spec/03-seasonal-specials.md §5
 */
import type { MatchDetailsView, TeamName } from '@smg/contracts';
import { useState, type CSSProperties, type ReactElement } from 'react';

import { intent } from '../live/socket.js';
import { useMatch } from '../live/useMatch.js';
import { useRound, type RoundLive } from '../live/useRound.js';
import { codeText } from '../round/roundText.js';
import { RoundScreen } from '../round/RoundScreen.js';
import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASON_NAMES, SEASONS, seasonColor } from '../season/season.js';
import { api, ApiError } from '../shell/http.js';
import { useSession } from '../shell/session.js';
import { HostMenu, type Values } from './HostMenu.js';
import './match.css';

function Teams({
  match,
  reload,
}: {
  readonly match: MatchDetailsView;
  readonly reload: () => void;
}): ReactElement | null {
  const viewer = useSession().session?.account?.id ?? null;
  const [problem, setProblem] = useState<string | null>(null);
  if (!match.youPlayer) return null;
  const mine = match.players.find((p) => p.playerKey === viewer)?.team ?? null;
  const choose = async (team: TeamName): Promise<void> => {
    const answer = await intent('team.choose', { code: match.code, team });
    setProblem(answer.ok ? null : codeText(answer.code));
    reload();
  };
  return (
    <div className="smg-stack">
      <p>Your season team (teams play in shared rounds):</p>
      <div className="match-teams" role="group" aria-label="Season team">
        {SEASONS.map((t) => (
          <button
            key={t}
            type="button"
            className="smg-btn"
            aria-pressed={mine === t}
            style={{ '--season': seasonColor(t) } as CSSProperties}
            onClick={() => void choose(t)}
          >
            <SeasonIcon season={t} size="1rem" /> {SEASON_NAMES[t]}
          </button>
        ))}
      </div>
      {problem === null ? null : (
        <p role="alert" className="round-refusal">
          {problem}
        </p>
      )}
    </div>
  );
}

function Players({ match }: { readonly match: MatchDetailsView }): ReactElement {
  const connected = new Set(match.connected);
  return (
    <ul className="smg-stack" data-testid="match-players">
      {match.players.map((p) => (
        <li key={p.playerKey}>
          {p.team === null ? null : <SeasonIcon season={p.team} size="1rem" />} {p.name}{' '}
          <span className="smg-muted">{connected.has(p.playerKey) ? 'here' : 'away'}</span>
        </li>
      ))}
    </ul>
  );
}

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

const LIVE = new Set(['created', 'countdown', 'open']);

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

// The round view alone while a round runs, else the lobby with the last result.
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
  const round =
    match.round === null ? null : (
      <RoundScreen
        live={live}
        gameId={match.gameId}
        viewerKey={viewer}
        hostMenu={hostMenu}
        teamPoints={match.teamStandings}
      />
    );
  if (status !== null && LIVE.has(status)) {
    return (
      <div className="match-live" data-testid="match">
        {round}
      </div>
    );
  }
  return <LobbyView match={match} refresh={refresh} hostMenu={hostMenu} round={round} />;
}

// Between rounds: the match head with the host menu, joining, the last result, the players.
function LobbyView(p: {
  readonly match: MatchDetailsView;
  readonly refresh: () => void;
  readonly hostMenu: ReactElement;
  readonly round: ReactElement | null;
}): ReactElement {
  const { match } = p;
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
      {p.round}
      <section className="smg-panel smg-stack" aria-labelledby="players-title">
        <h2 id="players-title">In this match</h2>
        <Teams match={match} reload={p.refresh} />
        <Players match={match} />
      </section>
    </div>
  );
}
