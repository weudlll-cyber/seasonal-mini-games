/**
 * @file   apps/web/src/round/RoundSide.tsx
 * @module web/round
 * @brief  The round's side panels: the roster and the live feed.
 *
 * Responsibility: the roster with each player's guesses, "cooling down" or "ready", team and
 *                 (individual mode) solve and place (02 §11); the live feed of the round's
 *                 events in plain lines from the platform and the game, newest first.
 * Depends on:     react, @smg/contracts, @smg-game/registry/web (types), ../live/useRound,
 *                 ../season/SeasonIcon, ./roundText
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §11, §12
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import type { ReactElement } from 'react';

import type { FeedItem } from '../live/useRound.js';
import { SeasonIcon } from '../season/SeasonIcon.js';
import { platformLine } from './roundText.js';

export function Roster({
  state,
  now,
}: {
  readonly state: RoundStateView;
  readonly now: number;
}): ReactElement {
  return (
    <section className="smg-panel round-roster" aria-labelledby="roster-title">
      <h2 id="roster-title">Players</h2>
      <ul data-testid="roster">
        {state.roster.map((r) => (
          <li key={r.playerKey}>
            {r.team === null ? null : <SeasonIcon season={r.team} size="1rem" />}{' '}
            <strong>{state.names[r.playerKey] ?? r.playerKey}</strong>{' '}
            <span className="smg-muted">
              {r.guesses} {r.guesses === 1 ? 'guess' : 'guesses'} ·{' '}
              {r.solved
                ? `solved${r.place === null ? '' : `, place ${String(r.place)}`}`
                : r.cooldownEndsAt > now
                  ? 'cooling down'
                  : 'ready'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// The line of one feed item: a game event (wrapped as Game) is the game's to word.
function lineOf(
  event: unknown,
  game: GameWeb | null,
  names: RoundStateView['names'],
): string | null {
  const e = event as { type?: string; event?: unknown };
  if (e.type === 'Game') return game?.text.event(e.event, names) ?? null;
  return platformLine(event, names);
}

export function Feed({
  feed,
  game,
  names,
}: {
  readonly feed: readonly FeedItem[];
  readonly game: GameWeb | null;
  readonly names: RoundStateView['names'];
}): ReactElement {
  const lines = feed.flatMap((item) => {
    const line = lineOf(item.event, game, names);
    return line === null ? [] : [{ key: item.key, line }];
  });
  return (
    <section className="smg-panel round-feed" aria-labelledby="feed-title">
      <h2 id="feed-title">Live</h2>
      {lines.length === 0 ? (
        <p className="smg-muted">Nothing yet.</p>
      ) : (
        <ol data-testid="feed" aria-live="polite">
          {lines.map((l) => (
            <li key={l.key}>{l.line}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
