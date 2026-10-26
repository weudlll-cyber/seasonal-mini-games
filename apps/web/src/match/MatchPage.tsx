/**
 * @file   apps/web/src/match/MatchPage.tsx
 * @module web/match
 * @brief  One match: its players and teams, joining and leaving, the host's console and the round.
 *
 * Responsibility: the match lobby of 02 §2: title, code and status; join or leave; the season
 *                 team picker (locked while a round runs, 03 §5); the players with their teams;
 *                 the host console; and the current or last round — the round screen while it
 *                 runs, its result afterwards. A player who joins during a round watches it
 *                 and plays from the next one.
 * Depends on:     react, @smg/contracts, ../live/*, ../shell/*, ../season/*, ./HostConsole,
 *                 ../round/RoundScreen, ../round/roundText
 * Used by:        ../shell/AppShell
 * Spec:           docs/spec/02-game-guess-the-number.md §2, §4, §11; docs/spec/03-seasonal-specials.md §5
 */
import type { MatchDetailsView, TeamName } from '@smg/contracts';
import { useState, type CSSProperties, type ReactElement } from 'react';

import { intent } from '../live/socket.js';
import { useMatch } from '../live/useMatch.js';
import { useRound } from '../live/useRound.js';
import { codeText } from '../round/roundText.js';
import { RoundScreen } from '../round/RoundScreen.js';
import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASON_NAMES, SEASONS, seasonColor } from '../season/season.js';
import { api, ApiError } from '../shell/http.js';
import { useSession } from '../shell/session.js';
import { HostConsole } from './HostConsole.js';

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

export function MatchPage({ code }: { readonly code: string }): ReactElement {
  const { match, missing, reload } = useMatch(code);
  const viewer = useSession().session?.account?.id ?? null;
  const live = useRound(match?.round?.id ?? null);
  if (missing)
    return (
      <section className="smg-panel">
        <h1>No such match</h1>
        <p>Check the code and try again.</p>
      </section>
    );
  if (match === null) return <p className="smg-muted">Loading the match…</p>;
  const refresh = (): void => {
    void reload();
    void live.reload();
  };
  return (
    <div className="smg-stack" data-testid="match">
      <header className="match-head">
        <h1>{match.title}</h1>
        <span className="smg-chip">
          Code {match.code} · {match.status}
        </span>
      </header>
      <JoinLeave match={match} reload={refresh} />
      <HostConsole match={match} roundStatus={live.state?.status ?? null} reload={refresh} />
      {match.round === null ? null : (
        <RoundScreen live={live} gameId={match.gameId} viewerKey={viewer} />
      )}
      <section className="smg-panel smg-stack" aria-labelledby="players-title">
        <h2 id="players-title">In this match</h2>
        <Teams match={match} reload={refresh} />
        <Players match={match} />
      </section>
    </div>
  );
}
