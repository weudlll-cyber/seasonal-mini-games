/**
 * @file   apps/web/src/round/RoundSide.tsx
 * @module web/round
 * @brief  The round's side column: the Live list (or the "Live | Chat" switch) and the team tiles.
 *
 * Responsibility: the Live list of the round's events, newest at the top, in a box of its own
 *                 height that scrolls inside itself: each row a dot in the player's colour,
 *                 the line, and an answer the room may see in colour (02 §6.2, §12). A player's
 *                 colour is their season team's when teams play, else one of the four season
 *                 colours by roster order, so it comes from the existing tokens. With a chat
 *                 (07 §2) a "Live | Chat" switch takes the Live list's place and height. The team
 *                 tiles: one small tile per season team with its match points and its players
 *                 in this round, shown only when teams play (03 §5).
 * Depends on:     react, @smg/contracts, @smg/game-sdk (FeedLine), @smg-game/registry/web (types),
 *                 ../live/useRound, ../season/*, ./roundText, ./switch.css
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §11, §12; docs/spec/03-seasonal-specials.md §5
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView, TeamName } from '@smg/contracts';
import type { FeedLine } from '@smg/game-sdk';
import { useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';

import type { FeedItem } from '../live/useRound.js';
import { SeasonIcon } from '../season/SeasonIcon.js';
import { SEASON_NAMES, SEASONS, seasonColor } from '../season/season.js';
import { platformLine } from './roundText.js';
import './switch.css';

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

interface FeedProps {
  readonly feed: readonly FeedItem[];
  readonly game: GameWeb | null;
  readonly state: RoundStateView;
}

// The rows of the Live list, newest at the top.
function FeedRows({ feed, game, state }: FeedProps): ReactElement {
  const rows = feed.flatMap((item) => {
    const line = lineOf(item.event, game, state.names);
    return line === null ? [] : [{ key: item.key, line }];
  });
  return (
    <>
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
    </>
  );
}

export function Feed(p: FeedProps): ReactElement {
  return (
    <section className="smg-panel round-feed" aria-labelledby="feed-title">
      <h2 id="feed-title">Live</h2>
      <FeedRows {...p} />
    </section>
  );
}

// The Live list, or with a chat a "Live | Chat" switch in its place: the chat takes the
// list's height and never adds any, so the round view still fits one screen (02 §12).
export function LiveOrChat(p: FeedProps & { readonly chat: ReactNode }): ReactElement {
  const [tab, setTab] = useState<'live' | 'chat'>('live');
  if (p.chat === null) return <Feed {...p} />;
  const tabs = [
    { id: 'live', label: 'Live' },
    { id: 'chat', label: 'Chat' },
  ] as const;
  return (
    <section className="smg-panel round-feed" aria-label="Live and chat">
      <div className="round-tabs" role="tablist" aria-label="Live or chat">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`round-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`round-panel-${t.id}`}
            className="round-tab"
            data-testid={`tab-${t.id}`}
            onClick={() => {
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* Both stay mounted: the chat keeps its room and the Live list its rows. */}
      <div
        className="round-tabpanel"
        role="tabpanel"
        id="round-panel-live"
        aria-labelledby="round-tab-live"
        hidden={tab !== 'live'}
      >
        <FeedRows {...p} />
      </div>
      <div
        className="round-tabpanel"
        role="tabpanel"
        id="round-panel-chat"
        aria-labelledby="round-tab-chat"
        hidden={tab !== 'chat'}
      >
        {p.chat}
      </div>
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
