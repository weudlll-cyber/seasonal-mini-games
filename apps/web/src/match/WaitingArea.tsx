/**
 * @file   apps/web/src/match/WaitingArea.tsx
 * @module web/match
 * @brief  The waiting area before a round: the team choice once per match, and who is here.
 *
 * Responsibility: shown before the first round and between rounds (O23): whether the next
 *                 round is set up and who starts it; and every player with their team (icon
 *                 and name, or "no team yet") and, apart from it, their connection (a dot and
 *                 "online" or "away"). A player picks a team once and keeps it for the match
 *                 (O26): until their first round the area says what teams are for and shows
 *                 the four team buttons, the chosen one pressed, in its season colour with its
 *                 icon in the text colour and a check (03 §5); afterwards no buttons, and
 *                 beside a result the area holds only the status line and the players. Team
 *                 refusals in plain words. A match without teams (O34) shows no team text,
 *                 buttons or column: the rows hold the name and the connection only. The match
 *                 chat is not part of the area: the match page shows it as a panel of its own
 *                 (./MatchPage, T116).
 * Depends on:     react, @smg/contracts, ../live/socket, ../round/roundText, ../season/*
 * Used by:        ./MatchPage
 * Spec:           docs/spec/02-game-guess-the-number.md §2, §4; docs/spec/03-seasonal-specials.md §5
 */
import type { MatchDetailsView, TeamName } from '@smg/contracts';
import { useState, type CSSProperties, type ReactElement } from 'react';

import { intent } from '../live/socket.js';
import { codeText } from '../round/roundText.js';
import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASONS, seasonColor, teamName } from '../season/season.js';

interface Props {
  readonly match: MatchDetailsView;
  // Under the last round's result: the area is about the next round.
  readonly after: boolean;
  // The signed-in viewer's player key, to mark their team.
  readonly viewerKey: string | null;
  readonly reload: () => void;
}

function Teams({ match, viewerKey, reload }: Props): ReactElement {
  const [problem, setProblem] = useState<string | null>(null);
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
            <SeasonIcon season={t} size="1rem" mono={mine === t} /> {teamName(t)}
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

// One row per player: the name, the team, and the connection apart from it (not by colour
// alone: a filled or a hollow dot, and the word).
function Players({ match }: { readonly match: MatchDetailsView }): ReactElement {
  const connected = new Set(match.connected);
  const team = (t: TeamName | null): ReactElement =>
    t === null ? (
      <span className="smg-muted">no team yet</span>
    ) : (
      <span className="match-player-team">
        <span aria-hidden="true">
          <SeasonIcon season={t} size="1rem" />
        </span>{' '}
        {teamName(t)}
      </span>
    );
  return (
    <ul className="match-players" data-testid="match-players" data-teams={match.teamMatch}>
      {match.players.map((p) => {
        const online = connected.has(p.playerKey);
        return (
          // The spaces between the parts keep them apart for screen readers; the grid
          // does not render them.
          <li key={p.playerKey}>
            <span className="match-player-name">{p.name}</span>{' '}
            {match.teamMatch ? <>{team(p.team)} </> : null}
            <span className="match-presence" data-online={online}>
              <span className="match-dot" aria-hidden="true" /> {online ? 'online' : 'away'}
            </span>
          </li>
        );
      })}
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
  // The team is chosen once, before the player's first round (O26), in a team match (O34).
  const choosing = match.teamMatch && match.youPlayer && !match.teamLocked;
  return (
    <section
      className="smg-panel smg-stack match-waiting"
      aria-labelledby="waiting-title"
      data-testid="waiting-area"
    >
      <h2 id="waiting-title">{p.after ? 'Next round' : 'Before the round'}</h2>
      <p data-testid="waiting-state">{stateText(match)}</p>
      {choosing || (match.teamMatch && !match.youPlayer && !p.after) ? (
        <p className="smg-muted">
          Pick a season team for this match: in shared rounds the winner’s team gets a point. You
          keep it for the whole match; without a choice you join the smallest team when your first
          round starts.
        </p>
      ) : null}
      {choosing ? <Teams {...p} /> : null}
      <h3>Players</h3>
      <Players match={match} />
    </section>
  );
}
