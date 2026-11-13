/**
 * @file   apps/web/src/match/WaitingArea.tsx
 * @module web/match
 * @brief  The waiting area before a round: the team choice once per match, and who is here.
 *
 * Responsibility: shown before the first round and between rounds (O23): whether the next
 *                 round is set up and who starts it (in a series: that it starts by itself, with
 *                 its round count and pause, ./SeriesStatus); a phased game's own panel for the
 *                 viewer's pre-picks (./GamePrefs); and every player with their name (one
 *                 line, cut with an ellipsis only where the row is too narrow,
 *                 ../round/PlayerName), their team under the heading "Team" as its icon alone
 *                 (its name the icon's accessible name and tooltip, "no team yet" a named dash,
 *                 ../season/TeamIcon, T212) and their connection (a dot and "online" or
 *                 "away"), the columns as wide as their widest entry (T210). A player picks a team once and keeps it for the match
 *                 (O26): until their first round the area says what teams are for and shows
 *                 the four team buttons, the chosen one pressed, in its season colour with its
 *                 icon in the text colour and a check (03 §5); afterwards no buttons, and
 *                 beside a result the area holds only the status line and the players. Team
 *                 refusals in plain words. A match without teams (O34) shows no team text,
 *                 buttons or column: the rows hold the name and the connection only. The match
 *                 chat is not part of the area: the match page shows it as a panel of its own
 *                 (./MatchPage, T116).
 * Depends on:     react, @smg/contracts, ../live/socket, ../round/PlayerName, ../round/roundText,
 *                 ../season/*, ./SeriesStatus, ./GamePrefs
 * Used by:        ./MatchPage
 * Spec:           docs/spec/02-game-guess-the-number.md §2, §4; docs/spec/03-seasonal-specials.md §5
 */
import type { MatchDetailsView, TeamName } from '@smg/contracts';
import { useState, type CSSProperties, type ReactElement } from 'react';

import { intent } from '../live/socket.js';
import { PlayerName } from '../round/PlayerName.js';
import { codeText } from '../round/roundText.js';
import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASONS, seasonColor, teamName } from '../season/season.js';
import { TeamIcon } from '../season/TeamIcon.js';
import { GamePrefs } from './GamePrefs.js';
import { SeriesStatus } from './SeriesStatus.js';

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
  return (
    <ul className="match-players" data-testid="match-players" data-teams={match.teamMatch}>
      {/* The team column's heading; a screen reader hears each icon's name instead. */}
      {match.teamMatch ? (
        <li className="match-players-head" aria-hidden="true">
          <span /> <span>Team</span> <span />
        </li>
      ) : null}
      {match.players.map((p) => {
        const online = connected.has(p.playerKey);
        return (
          // The spaces between the parts keep them apart for screen readers; the grid
          // does not render them.
          <li key={p.playerKey}>
            <PlayerName name={p.name} steps={p.steps} />{' '}
            {match.teamMatch ? (
              <>
                <TeamIcon team={p.team} className="match-player-team" />{' '}
              </>
            ) : null}
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
  // A series starts its next round by itself after the pause (04 §4.8 rule 7).
  if (match.series?.nextAt != null) {
    return match.youHost
      ? 'The next round starts by itself. Change its settings in the Host menu.'
      : 'The next round starts by itself.';
  }
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
      <SeriesStatus match={match} />
      <GamePrefs match={match} />
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
