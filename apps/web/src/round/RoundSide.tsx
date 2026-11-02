/**
 * @file   apps/web/src/round/RoundSide.tsx
 * @module web/round
 * @brief  The round's players: every player's colour, the team tiles and the Players panel.
 *
 * Responsibility: a player's colour, used by the dots of the round's list: their season
 *                 team's when teams play, else one of the four season colours by roster
 *                 order, so it comes from the existing tokens. The team tiles: one small tile
 *                 per season team with its match points and its players in this round, shown
 *                 only when teams play (03 §5), each named "Team Spring" (O52). The focus
 *                 mode's Players panel (O46) holds the tiles and the round's players with
 *                 colour, team and number of guesses.
 * Depends on:     react, @smg/contracts, @smg/game-sdk (formatNumber), ../season/* (teamName),
 *                 ./PlayerName, ./players.css
 * Used by:        ./RoundScreen, ./RoundLog
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §5
 */
import type { RoundStateView, TeamName } from '@smg/contracts';
import { formatNumber } from '@smg/game-sdk';
import type { CSSProperties, ReactElement } from 'react';

import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASONS, seasonColor, teamName } from '../season/season.js';
import { PlayerName } from './PlayerName.js';
import './players.css';

// A player's colour: their team's when teams play, else a season colour by roster order.
export function playerColor(state: RoundStateView, key: string): string {
  const row = state.roster.findIndex((r) => r.playerKey === key);
  const team = state.roster[row]?.team ?? null;
  if (state.teamsOn && team !== null) return seasonColor(team);
  return seasonColor(SEASONS[Math.max(0, row) % SEASONS.length] ?? 'spring');
}

// Every roster player's colour by key, for a game that draws players beyond the list (T125).
export const colorsOf = (state: RoundStateView): Readonly<Record<string, string>> =>
  Object.fromEntries(state.roster.map((r) => [r.playerKey, playerColor(state, r.playerKey)]));

// The Players panel (O46): the team tiles with their match points when teams play, then every
// player of the round with their colour, team and guesses, the viewer first as "You".
export function PlayersPanelBody(p: {
  readonly state: RoundStateView;
  readonly points: readonly { readonly team: TeamName; readonly points: number }[];
  readonly viewerKey: string | null;
}): ReactElement {
  const { state } = p;
  const rows = [...state.roster].sort(
    (a, b) => Number(b.playerKey === p.viewerKey) - Number(a.playerKey === p.viewerKey),
  );
  return (
    <div className="round-players" data-testid="players-panel">
      <TeamTiles state={state} points={p.points} />
      <ul className="round-player-list" aria-label="Players in this round">
        {rows.map((r) => (
          <li key={r.playerKey} data-own={r.playerKey === p.viewerKey}>
            <span
              className="round-dot"
              aria-hidden="true"
              style={{ '--dot': playerColor(state, r.playerKey) } as CSSProperties}
            />
            <PlayerName
              name={r.playerKey === p.viewerKey ? 'You' : (state.names[r.playerKey] ?? r.playerKey)}
            />
            {state.teamsOn && r.team !== null ? (
              <span className="round-player-team">{teamName(r.team)}</span>
            ) : null}
            <span className="round-player-guesses">
              {r.guesses} {r.guesses === 1 ? 'guess' : 'guesses'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeamTiles({
  state,
  points,
}: {
  readonly state: RoundStateView;
  readonly points: readonly { readonly team: TeamName; readonly points: number }[];
}): ReactElement | null {
  if (!state.teamsOn) return null;
  return (
    <section className="round-teams" aria-label="Teams" data-testid="team-tiles">
      {SEASONS.map((team) => {
        const players = state.roster.filter((r) => r.team === team).length;
        const score = points.find((p) => p.team === team)?.points ?? 0;
        return (
          <div
            key={team}
            className="round-team"
            style={{ '--season': seasonColor(team) } as CSSProperties}
          >
            <SeasonIcon season={team} size="1.1rem" />
            <span className="round-team-name">{teamName(team)}</span>
            <strong className="round-team-points">{formatNumber(score)}</strong>
            <span className="smg-visually-hidden">
              {score === 1 ? 'point' : 'points'}, {players} {players === 1 ? 'player' : 'players'}
            </span>
          </div>
        );
      })}
    </section>
  );
}
