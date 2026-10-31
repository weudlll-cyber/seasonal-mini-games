/**
 * @file   apps/web/src/round/RoundLog.tsx
 * @module web/round
 * @brief  The round's one list: every guess the viewer may see, and the round's events (O20).
 *
 * Responsibility: the guess rows come from the game's view of this viewer (so they survive a
 *                 reload and follow the round's visibility and Frost, DECISIONS T74), the event
 *                 rows from the live frames; both in one box, newest at the top, that fills the
 *                 height it gets and scrolls only inside itself. A guess row: the player's
 *                 colour dot, the name ("You" for the viewer), the number, higher or lower in
 *                 colour, and the closeness comment in smaller text under it (O21); the
 *                 viewer's own rows have the season colour behind them, and under Frost an own
 *                 row says "answer arriving in 2 s". Events (Spring Herald, Leaf Fall, Heatwave,
 *                 halving, solves, the round opening and ending) are quieter one-line rows.
 * Depends on:     react, @smg/contracts, @smg/game-sdk (rows), @smg-game/registry/web (types),
 *                 ../live/useRound, ./RoundSide (colours), ./roundText
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §6.2, §6.3, §12; docs/spec/03-seasonal-specials.md §2.4
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import type { FeedLine, GuessRow } from '@smg/game-sdk';
import type { CSSProperties, ReactElement } from 'react';

import type { FeedItem } from '../live/useRound.js';
import { playerColor } from './RoundSide.js';
import { platformLine } from './roundText.js';

const ARROW = { higher: '↑', lower: '↓', correct: '✓' } as const;

type Row =
  | { readonly kind: 'guess'; readonly key: string; readonly at: number; readonly guess: GuessRow }
  | { readonly kind: 'event'; readonly key: string; readonly at: number; readonly line: FeedLine };

// The row of one feed item: a game event (wrapped as Game) is the game's to word.
function lineOf(event: unknown, game: GameWeb | null, names: RoundStateView['names']) {
  const e = event as { type?: string; event?: unknown };
  if (e.type === 'Game') return game?.text.event(e.event, names) ?? null;
  return platformLine(event, names);
}

function rowsOf(feed: readonly FeedItem[], game: GameWeb | null, state: RoundStateView) {
  const guesses: Row[] =
    game === null || state.game === null
      ? []
      : game.text
          .guesses(state.game)
          .map((g) => ({ kind: 'guess', key: `g${g.key}`, at: g.at, guess: g }));
  const events = feed.flatMap((item): Row[] => {
    const line = lineOf(item.event, game, state.names);
    return line === null ? [] : [{ kind: 'event', key: `e${item.key}`, at: item.at, line }];
  });
  return [...guesses, ...events].sort((a, b) => b.at - a.at);
}

const dot = (state: RoundStateView, key: string | null) =>
  key === null ? undefined : ({ '--dot': playerColor(state, key) } as CSSProperties);

interface RowProps {
  readonly guess: GuessRow;
  readonly state: RoundStateView;
  readonly viewerKey: string | null;
  readonly now: number;
}

// Higher or lower in colour, or under Frost the seconds until an own answer arrives.
function Answer({ guess, state, now }: Omit<RowProps, 'viewerKey'>): ReactElement | null {
  if (guess.feedback !== null) {
    return (
      <span className="round-answer" data-feedback={guess.feedback}>
        {guess.feedback} {ARROW[guess.feedback]}
      </span>
    );
  }
  if (!guess.pending) return null;
  const left = Math.max(0, Math.ceil((guess.at + (state.frostDelayMs ?? 0) - now) / 1_000));
  return <span className="round-arriving">answer arriving in {left} s</span>;
}

function GuessLine({ guess, state, viewerKey, now }: RowProps): ReactElement {
  // A solved player in individual mode watches as a spectator; their rows stay "You".
  const own = guess.playerId === null || guess.playerId === viewerKey;
  const key = guess.playerId ?? viewerKey;
  const name = own ? 'You' : (state.names[key ?? ''] ?? key ?? '');
  return (
    <li className="round-row" data-own={own} data-tier={guess.tier ?? undefined}>
      <span className="round-dot" aria-hidden="true" style={dot(state, key)} />
      <span className="round-who">{name}</span>
      <span className="round-value">{guess.value === null ? 'guessed' : guess.value}</span>
      <Answer guess={guess} state={state} now={now} />
      {guess.comment === null ? null : <span className="round-comment">{guess.comment}</span>}
    </li>
  );
}

export function RoundLog(p: {
  readonly feed: readonly FeedItem[];
  readonly game: GameWeb | null;
  readonly state: RoundStateView;
  readonly viewerKey: string | null;
  readonly now: number;
}): ReactElement {
  const rows = rowsOf(p.feed, p.game, p.state);
  return (
    <section className="round-log" aria-label="Guesses and events">
      {rows.length === 0 ? (
        <p className="smg-muted">No guesses yet.</p>
      ) : (
        <ol data-testid="guess-list" aria-live="polite">
          {rows.map((row) =>
            row.kind === 'guess' ? (
              <GuessLine
                key={row.key}
                guess={row.guess}
                state={p.state}
                viewerKey={p.viewerKey}
                now={p.now}
              />
            ) : (
              <li key={row.key} className="round-row round-row--event">
                <span
                  className="round-dot"
                  aria-hidden="true"
                  style={dot(p.state, row.line.playerId)}
                />
                <span>{row.line.text}</span>
              </li>
            ),
          )}
        </ol>
      )}
    </section>
  );
}
