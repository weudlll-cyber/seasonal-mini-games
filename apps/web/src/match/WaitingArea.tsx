/**
 * @file   apps/web/src/match/WaitingArea.tsx
 * @module web/match
 * @brief  The waiting area before a round: what teams are for, the team picker, who is here.
 *
 * Responsibility: shown before the first round and between rounds (O23): whether the next
 *                 round is set up and who starts it; one sentence on what the season teams are
 *                 for; for a match player the four team buttons, the chosen one pressed, in
 *                 its season colour and with a check (03 §5); and every player with their team
 *                 icon and "here" or "away". Team refusals in plain words.
 * Depends on:     react, @smg/contracts, ../live/socket, ../round/roundText, ../season/*
 * Used by:        ./MatchPage
 * Spec:           docs/spec/02-game-guess-the-number.md §2, §4; docs/spec/03-seasonal-specials.md §5
 */
import type { MatchDetailsView, TeamName } from '@smg/contracts';
import { useState, type CSSProperties, type ReactElement } from 'react';

import { intent } from '../live/socket.js';
import { codeText } from '../round/roundText.js';
import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASON_NAMES, SEASONS, seasonColor } from '../season/season.js';

interface Props {
  readonly match: MatchDetailsView;
  // The signed-in viewer's player key, to mark their team.
  readonly viewerKey: string | null;
  readonly reload: () => void;
}

function Teams({ match, viewerKey, reload }: Props): ReactElement | null {
  const [problem, setProblem] = useState<string | null>(null);
  if (!match.youPlayer) return null;
  const mine = match.players.find((p) => p.playerKey === viewerKey)?.team ?? null;
  const choose = async (team: TeamName): Promise<void> => {
    const answer = await intent('team.choose', { code: match.code, team });
    setProblem(answer.ok ? null : codeText(answer.code));
    reload();
  };
  return (
    <>
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
            {mine === t ? (
              <span className="match-team-check" aria-hidden="true">
                ✓
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {problem === null ? null : (
        <p role="alert" className="round-refusal">
          {problem}
        </p>
      )}
    </>
  );
}

function Players({ match }: { readonly match: MatchDetailsView }): ReactElement {
  const connected = new Set(match.connected);
  return (
    <ul className="match-players" data-testid="match-players">
      {match.players.map((p) => (
        <li key={p.playerKey}>
          {p.team === null ? null : <SeasonIcon season={p.team} size="1rem" />} {p.name}{' '}
          <span className="smg-muted">{connected.has(p.playerKey) ? 'here' : 'away'}</span>
        </li>
      ))}
    </ul>
  );
}

// Whether the next round is set up, and who acts now.
function stateText(match: MatchDetailsView): string {
  if (match.round?.status === 'created') {
    return match.youHost
      ? 'The next round is set up. Start it from the Host menu.'
      : 'The next round is set up. The host starts it soon.';
  }
  return match.youHost
    ? 'Set up the next round from the Host menu.'
    : 'Waiting for the host to start the next round.';
}

export function WaitingArea(p: Props): ReactElement {
  const { match } = p;
  return (
    <section
      className="smg-panel smg-stack match-waiting"
      aria-labelledby="waiting-title"
      data-testid="waiting-area"
    >
      <h2 id="waiting-title">{match.round === null ? 'Before the first round' : 'Next round'}</h2>
      <p data-testid="waiting-state">{stateText(match)}</p>
      <p className="smg-muted">
        Pick a season team: in shared rounds the winner’s team gets a point. Players without a team
        join the smallest one when the round starts.
      </p>
      <Teams {...p} />
      <h3>Players</h3>
      <Players match={match} />
    </section>
  );
}
