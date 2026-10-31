/**
 * @file   apps/web/src/round/RoundSide.tsx
 * @module web/round
 * @brief  The round's side column: the team tiles; and every player's colour.
 *
 * Responsibility: a player's colour, used by the dots of the round's list: their season
 *                 team's when teams play, else one of the four season colours by roster
 *                 order, so it comes from the existing tokens. The team tiles: one small tile
 *                 per season team with its match points and its players in this round, shown
 *                 only when teams play (03 §5); they sit at the top of the right column, whose
 *                 rest stays free since the guess list moved to the main area (O20).
 * Depends on:     react, @smg/contracts, ../season/*
 * Used by:        ./RoundScreen, ./RoundLog
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §5
 */
import type { RoundStateView, TeamName } from '@smg/contracts';
import type { CSSProperties, ReactElement } from 'react';

import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASON_NAMES, SEASONS, seasonColor } from '../season/season.js';

// A player's colour: their team's when teams play, else a season colour by roster order.
export function playerColor(state: RoundStateView, key: string): string {
  const row = state.roster.findIndex((r) => r.playerKey === key);
  const team = state.roster[row]?.team ?? null;
  if (state.teamsOn && team !== null) return seasonColor(team);
  return seasonColor(SEASONS[Math.max(0, row) % SEASONS.length] ?? 'spring');
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
            <span className="round-team-name">{SEASON_NAMES[team]}</span>
            <strong className="round-team-points">{score}</strong>
            <span className="smg-visually-hidden">
              {score === 1 ? 'point' : 'points'}, {players} {players === 1 ? 'player' : 'players'}
            </span>
          </div>
        );
      })}
    </section>
  );
}
