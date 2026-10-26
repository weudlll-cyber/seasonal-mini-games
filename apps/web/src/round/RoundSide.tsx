/**
 * @file   apps/web/src/round/RoundSide.tsx
 * @module web/round
 * @brief  The round's side column: the Live list and the team tiles.
 *
 * Responsibility: the Live list of the round's events, newest at the top, in a box of its own
 *                 height that scrolls inside itself: each row a dot in the player's colour,
 *                 the line, and an answer the room may see in colour (02 §6.2, §12). A player's
 *                 colour is their season team's when teams play, else one of the four season
 *                 colours by roster order, so it comes from the existing tokens. The team
 *                 tiles: one small tile per season team with its match points and its players
 *                 in this round, shown only when teams play (03 §5).
 * Depends on:     react, @smg/contracts, @smg/game-sdk (FeedLine), @smg-game/registry/web (types),
 *                 ../live/useRound, ../season/*, ./roundText
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §11, §12; docs/spec/03-seasonal-specials.md §5
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView, TeamName } from '@smg/contracts';
import type { FeedLine } from '@smg/game-sdk';
import type { CSSProperties, ReactElement } from 'react';

import type { FeedItem } from '../live/useRound.js';
import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASON_NAMES, SEASONS, seasonColor } from '../season/season.js';
import { platformLine } from './roundText.js';

const ARROW = { higher: '↑', lower: '↓', correct: '✓' } as const;

// A player's colour: their team's when teams play, else a season colour by roster order.
export function playerColor(state: RoundStateView, key: string): string {
  const row = state.roster.findIndex((r) => r.playerKey === key);
  const team = state.roster[row]?.team ?? null;
  if (state.teamsOn && team !== null) return seasonColor(team);
  return seasonColor(SEASONS[Math.max(0, row) % SEASONS.length] ?? 'spring');
}

// The row of one feed item: a game event (wrapped as Game) is the game's to word.
function lineOf(
  event: unknown,
  game: GameWeb | null,
  names: RoundStateView['names'],
): FeedLine | null {
  const e = event as { type?: string; event?: unknown };
  if (e.type === 'Game') return game?.text.event(e.event, names) ?? null;
  return platformLine(event, names);
}

export function Feed({
  feed,
  game,
  state,
}: {
  readonly feed: readonly FeedItem[];
  readonly game: GameWeb | null;
  readonly state: RoundStateView;
}): ReactElement {
  const rows = feed.flatMap((item) => {
    const line = lineOf(item.event, game, state.names);
    return line === null ? [] : [{ key: item.key, line }];
  });
  return (
    <section className="smg-panel round-feed" aria-labelledby="feed-title">
      <h2 id="feed-title">Live</h2>
      {rows.length === 0 ? (
        <p className="smg-muted">Nothing yet.</p>
      ) : (
        <ol data-testid="feed" aria-live="polite">
          {rows.map(({ key, line }) => (
            <li key={key}>
              <span
                className="round-dot"
                aria-hidden="true"
                style={
                  line.playerId === null
                    ? undefined
                    : ({ '--dot': playerColor(state, line.playerId) } as CSSProperties)
                }
              />
              <span>{line.text}</span>
              {line.feedback === null ? null : (
                <span className="round-answer" data-feedback={line.feedback}>
                  {' '}
                  {line.feedback} {ARROW[line.feedback]}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
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
