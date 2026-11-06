/**
 * @file   apps/web/src/round/RoundLog.tsx
 * @module web/round
 * @brief  The round's lists: this round's guesses, the viewer's own, and everything with events.
 *
 * Responsibility: the guess rows come from the game's view of this viewer (so they survive a
 *                 reload and follow the round's visibility and Frost, DECISIONS T74), the event
 *                 rows from the live frames; newest at the top, in a box that fills the height
 *                 it gets and scrolls only inside itself. Only this round, nothing of earlier
 *                 rounds or the match (O54). Three kinds (T141, T142, T150):
 *                 `main`, the round's guesses (own rows highlighted), under a one-line head
 *                 with their count ("12 guesses"), the event banner in the count's place for
 *                 5 s (./SpecialBanner) and "Log (M)" for the whole list (M: its guesses and
 *                 events); in individual mode only the viewer's rows, without "You" and the
 *                 own colour, and on a phone the others' counts in a row of their own above
 *                 the list ("Others: bot-01: 8 guesses · bot-02: 5", each player has their
 *                 own secret; "timed out" beside a player out of time, O71; each name through
 *                 ./PlayerName with its Discord steps, 07 §7),
 *                 which a banner never replaces (a desktop has the info column's Others panel
 *                 instead, ./RoundSide, T260); `own`, "Your guesses", the
 *                 viewer's guesses and answers only; `all`, the guesses with every event,
 *                 where each special's line always stays (the Log panel). Rows are one line
 *                 (./GuessLine); on a phone the newest row's comment shows under it and a tap
 *                 on a row shows or hides its own.
 * Depends on:     react, @smg/contracts, @smg/game-sdk (rows), @smg-game/registry/web (types),
 *                 ../live/useRound, ./GuessLine, ./PlayerName, ./RoundSide (guessCount),
 *                 ./SpecialBanner, ./roundText, ./roundLog.css
 * Used by:        ./RoundBody
 * Spec:           docs/spec/02-game-guess-the-number.md §6.2, §6.3, §12; docs/spec/03-seasonal-specials.md §2.4;
 *                 docs/spec/07-integration.md §7
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import type { FeedLine, GuessRow } from '@smg/game-sdk';
import { Fragment, useState, type ReactElement } from 'react';

import type { FeedItem } from '../live/useRound.js';
import { EventLine, GuessLine } from './GuessLine.js';
import { PlayerName } from './PlayerName.js';
import { roundMarks } from './playerMarks.js';
import { guessCount } from './RoundSide.js';
import { SpecialBanner } from './SpecialBanner.js';
import { platformLine } from './roundText.js';
import './roundLog.css';

type Row =
  | { readonly kind: 'guess'; readonly key: string; readonly at: number; readonly guess: GuessRow }
  | { readonly kind: 'event'; readonly key: string; readonly at: number; readonly line: FeedLine };

// The row of one feed item: a game event (wrapped as Game) is the game's to word.
function lineOf(event: unknown, game: GameWeb | null, names: RoundStateView['names']) {
  const e = event as { type?: string; event?: unknown };
  if (e.type === 'Game') return game?.text.event(e.event, names) ?? null;
  return platformLine(event, names);
}

// The compact list's way to the whole list: its panel's state and opening button.
export interface MoreRows {
  readonly open: boolean;
  readonly toggle: () => void;
  readonly button: (el: HTMLButtonElement | null) => void;
}

export interface LogProps {
  readonly feed: readonly FeedItem[];
  readonly game: GameWeb | null;
  readonly state: RoundStateView;
  readonly viewerKey: string | null;
  readonly now: number;
  readonly kind: 'main' | 'own' | 'all';
  readonly phone: boolean;
  // The main list's banner line (./SpecialBanner) and its way to the All panel.
  readonly banner?: string | null;
  readonly more?: MoreRows;
}

// The guesses a list shows: in individual mode, and in "Your guesses", the viewer's own only.
function guessesOf(p: LogProps): Row[] {
  if (p.game === null || p.state.game === null) return [];
  const ownOnly = p.kind === 'own' || p.state.secretMode === 'individual';
  return p.game.text
    .guesses(p.state.game)
    .filter((g) => !ownOnly || g.playerId === null)
    .map((g) => ({ kind: 'guess', key: `g${g.key}`, at: g.at, guess: g }));
}

function eventsOf(p: LogProps): Row[] {
  return p.feed.flatMap((item): Row[] => {
    const line = lineOf(item.event, p.game, p.state.names);
    return line === null ? [] : [{ kind: 'event', key: `e${item.key}`, at: item.at, line }];
  });
}

const LIST_IDS = { main: 'guess-list', own: 'own-list', all: 'all-list' } as const;

// Individual mode: the other players and their guess counts, the first with its unit
// ("8 guesses", then "5"), and "timed out" for a player out of the round (O71); empty when
// the viewer plays alone.
function othersOf(state: RoundStateView, viewerKey: string | null) {
  return state.roster
    .filter((r) => r.playerKey !== viewerKey)
    .map((r, i) => ({
      key: r.playerKey,
      name: state.names[r.playerKey] ?? r.playerKey,
      count: `${i === 0 ? guessCount(r.guesses) : String(r.guesses)}${r.timedOut ? ', timed out' : ''}`,
    }));
}

// The others' line as text, "Others: bot-01: 8 guesses · bot-02: 5" (its title); null alone.
export function othersLine(state: RoundStateView, viewerKey: string | null): string | null {
  const others = othersOf(state, viewerKey);
  if (others.length === 0) return null;
  return `Others: ${others.map((o) => `${o.name}: ${o.count}`).join(' · ')}`;
}

// The others' line: each name as everywhere else, with the player's Discord steps (07 §7).
function OthersLine(p: { readonly state: RoundStateView; readonly viewerKey: string | null }) {
  const title = othersLine(p.state, p.viewerKey);
  if (title === null) return null;
  return (
    <p className="round-log-others" data-testid="others-line" title={title}>
      Others:{' '}
      {othersOf(p.state, p.viewerKey).map((o, i) => (
        <Fragment key={o.key}>
          {i === 0 ? null : ' · '}
          <PlayerName name={o.name} steps={p.state.steps?.[o.key]} />
          {`: ${o.count}`}
        </Fragment>
      ))}
    </p>
  );
}

// The others' line shows in individual mode on a phone only; a desktop's info column has
// them as the Others panel (./RoundSide, T260).
const showsOthers = (p: LogProps): boolean =>
  p.kind === 'main' && p.phone && p.state.secretMode === 'individual';

// The one-line head: what the list holds, the banner in its place while one shows, "Log".
function Head(p: LogProps & { readonly count: number; readonly all: number }): ReactElement {
  const title = p.kind === 'own' ? 'Your guesses' : guessCount(p.count);
  const banner = p.banner ?? null;
  return (
    <div className="round-log-head">
      {p.kind === 'main' ? <SpecialBanner text={banner} /> : null}
      {banner === null ? (
        <span className="round-log-title" data-testid="list-title">
          {title}
        </span>
      ) : null}
      {p.more === undefined ? null : (
        <button
          ref={p.more.button}
          type="button"
          className="smg-btn round-log-all"
          aria-expanded={p.more.open}
          data-testid="list-all"
          onClick={p.more.toggle}
        >
          Log ({p.all})
        </button>
      )}
    </div>
  );
}

// The phone's comments: the newest row's shows, a tap flips a row from its default.
function useComments() {
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string): void => {
    setFlipped((was) => {
      const next = new Set(was);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  };
  return { isOpen: (key: string, newest: boolean) => newest !== flipped.has(key), toggle };
}

export function RoundLog(p: LogProps): ReactElement {
  const comments = useComments();
  const shown = guessesOf(p);
  const events = p.kind === 'main' || p.kind === 'all' ? eventsOf(p) : [];
  const rows = (p.kind === 'all' ? [...shown, ...events] : shown).sort((a, b) => b.at - a.at);
  const newest = rows.find((r) => r.kind === 'guess')?.key ?? null;
  const solo = p.state.secretMode === 'individual';
  // A game with player tags: every row names its player by tag and marker (O62).
  const marks = roundMarks(p.state, p.game, p.viewerKey);
  return (
    <section className="round-log" aria-label={p.kind === 'own' ? 'Your guesses' : 'Guesses'}>
      {p.kind === 'all' ? null : (
        <Head {...p} count={shown.length} all={shown.length + events.length} />
      )}
      {showsOthers(p) ? <OthersLine state={p.state} viewerKey={p.viewerKey} /> : null}
      {rows.length === 0 ? (
        <p className="smg-muted round-log-empty">No guesses yet.</p>
      ) : (
        <ol data-testid={LIST_IDS[p.kind]} aria-live="polite">
          {rows.map((row) =>
            row.kind === 'guess' ? (
              <GuessLine
                key={row.key}
                guess={row.guess}
                state={p.state}
                viewerKey={p.viewerKey}
                now={p.now}
                phone={p.phone}
                solo={solo}
                bare={p.kind === 'own'}
                marks={marks}
                open={comments.isOpen(row.key, row.key === newest)}
                toggle={() => {
                  comments.toggle(row.key);
                }}
              />
            ) : (
              <EventLine key={row.key} line={row.line} state={p.state} />
            ),
          )}
        </ol>
      )}
    </section>
  );
}
