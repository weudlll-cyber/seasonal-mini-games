/**
 * @file   apps/web/src/round/GuessLine.tsx
 * @module web/round
 * @brief  One row of the round's list: a guess on one line, or an event.
 *
 * Responsibility: a guess row on one line on both layouts (T142): the player's colour dot, the
 *                 name ("You" for the viewer), the guess (the number, a game's guess in words,
 *                 or its colour dots with their names as accessible text and tooltip, T143),
 *                 higher or lower in colour or a game's answer in words with its pegs (T119),
 *                 and on a desktop the closeness comment on the same line, cut with an
 *                 ellipsis, its whole text in the tooltip. Where the line is short the comment
 *                 gives way first, then the name; the guess and the answer never (T150). On a
 *                 phone the comment is a second line, shown for the newest row; a tap on a row
 *                 shows or hides its own (the list keeps which, ./RoundLog). The viewer's own
 *                 rows have their own colour behind them (their dot's, `--own`). `solo` (every
 *                 row is the viewer's: individual mode) drops the dot, the name and the own
 *                 colour; `bare` ("Your guesses") keeps the guess and the answer only. Under
 *                 Frost every held answer, the viewer's and another player's alike, says
 *                 "answer arriving…" with the seconds left in a small badge. An event (Spring Herald,
 *                 Heatwave, halving, solves, the round opening and ending) is a quieter row; a
 *                 special's own row (Leaf Fall) stands out on the season's tint with its icon
 *                 (T115). With `marks` (a game with player tags, O62) a row starts with the
 *                 player's marker and tag in place of the dot ("you" for the viewer), and
 *                 hovering, focusing or (phone) tapping it highlights the player on the
 *                 game's board, a tap for 3 s; a row of the highlighted player stands out,
 *                 the others fade. Moved out of ./RoundLog to keep each file under the size
 *                 limit.
 * Depends on:     react, @smg/contracts, @smg/game-sdk (rows, formatNumber, marks), @smg/ui
 *                 (PlayerMark, highlight), ../season/SeasonIcon, ./RoundSide (colours),
 *                 ./roundMarks.css
 * Used by:        ./RoundLog
 * Spec:           docs/spec/02-game-guess-the-number.md §6.2, §6.3, §12; docs/spec/03-seasonal-specials.md §2.4
 */
import type { RoundStateView } from '@smg/contracts';
import {
  formatNumber,
  type FeedLine,
  type GuessRow,
  type GuessSwatch,
  type PlayerMark as Mark,
} from '@smg/game-sdk';
import { flashHighlight, lit, PlayerMark, setHighlight, useHighlight } from '@smg/ui';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { SeasonIcon } from '../season/SeasonIcon.js';
import { playerColor } from './RoundSide.js';
import './roundMarks.css';

const ARROW = { higher: '↑', lower: '↓', correct: '✓' } as const;

const dot = (state: RoundStateView, key: string | null) =>
  key === null ? undefined : ({ '--dot': playerColor(state, key) } as CSSProperties);

export interface RowProps {
  readonly guess: GuessRow;
  readonly state: RoundStateView;
  readonly viewerKey: string | null;
  readonly now: number;
  // A phone: the comment on a second line, shown while `open`; a tap on the row toggles it.
  readonly phone: boolean;
  // Every row is the viewer's (individual mode): no dot, no name, no own colour (T150).
  readonly solo: boolean;
  // The guess and its answer only ("Your guesses", T150).
  readonly bare: boolean;
  readonly open: boolean;
  readonly toggle: () => void;
  // Every player's tag and marker when the game identifies players by tag (O62), else null.
  readonly marks: Readonly<Record<string, Mark>> | undefined;
}

// Pegs before an answer's words (T119): filled for a hit, ringed for a near one, hollow for a
// miss; the words beside them say the same, so the marks are never the only sign.
function Pegs({ pegs }: { readonly pegs: readonly string[] }): ReactElement {
  return (
    <span className="round-pegs" aria-hidden="true">
      {pegs.map((peg, i) => (
        <span key={i} className="round-peg" data-peg={peg} />
      ))}
    </span>
  );
}

// A guess as colour dots in order, each named for screen readers and on hover (T143).
function Swatches({ swatches }: { readonly swatches: readonly GuessSwatch[] }): ReactElement {
  return (
    <span className="round-value round-swatches">
      {swatches.map((s, i) => (
        <span
          key={i}
          className="round-swatch"
          role="img"
          aria-label={s.name}
          title={s.name}
          style={{ '--swatch': s.color } as CSSProperties}
        />
      ))}
    </span>
  );
}

// Higher or lower in colour, a game's own answer in words, or under Frost the seconds until a
// held answer arrives (the viewer's own or, where the round shows them, another player's).
function Answer({ guess, state, now }: Pick<RowProps, 'guess' | 'state' | 'now'>) {
  if (guess.feedback !== null) {
    return (
      <span className="round-answer" data-feedback={guess.feedback}>
        {guess.feedback} {ARROW[guess.feedback]}
      </span>
    );
  }
  const answer = guess.answer ?? null;
  if (answer !== null) {
    return (
      <span className="round-answer" data-feedback={answer.tone}>
        {answer.pegs === undefined ? null : <Pegs pegs={answer.pegs} />}
        {answer.text}
      </span>
    );
  }
  if (!guess.pending) return null;
  // The same marker for every held answer (T150): its seconds count from the receive time.
  const left = Math.max(0, Math.ceil((guess.at + (state.frostDelayMs ?? 0) - now) / 1_000));
  return (
    <span className="round-arriving">
      answer arriving… <span className="round-arriving-left">{left} s</span>
    </span>
  );
}

// The guess: its colour dots, a game's own text, the number, or "guessed" where it is hidden.
function Value({ guess }: { readonly guess: GuessRow }): ReactElement {
  const swatches = guess.swatches ?? null;
  if (swatches !== null && swatches.length > 0) return <Swatches swatches={swatches} />;
  const text = guess.text ?? (guess.value === null ? 'guessed' : formatNumber(guess.value));
  return <span className="round-value">{text}</span>;
}

// The player's dot and name; none where every row is the viewer's or only the guess shows.
function Who(p: RowProps): ReactElement | null {
  if (p.solo || p.bare) return null;
  // The viewer's own rows come without a player: they are "You" (a solved player too, O25).
  const key = p.guess.playerId ?? p.viewerKey;
  const name = p.guess.playerId === null ? 'You' : (p.state.names[key ?? ''] ?? key ?? '');
  const mark = key === null ? undefined : p.marks?.[key];
  return (
    <>
      {mark === undefined ? (
        <span className="round-dot" aria-hidden="true" style={dot(p.state, key)} />
      ) : (
        <PlayerMark mark={mark} />
      )}
      <span className="round-who" title={name}>
        {name}
      </span>
    </>
  );
}

// A tagged row's part in the highlight (O62): hover and focus highlight its player while
// they last, a tap on a phone for 3 s; `data-hl` says whether the row is the highlighted
// player's ('on') or another's ('off').
function useRowHighlight(p: RowProps) {
  const highlighted = useHighlight();
  const key = p.guess.playerId ?? p.viewerKey;
  if (p.marks === undefined || key === null) return {};
  const off = (): void => {
    setHighlight(null);
  };
  return {
    'data-hl': lit(highlighted, [key]),
    // Reachable by keyboard on a desktop; a phone's row is a tap target already.
    tabIndex: p.phone ? undefined : 0,
    onMouseEnter: () => {
      setHighlight(key);
    },
    onMouseLeave: off,
    onFocus: () => {
      setHighlight(key);
    },
    onBlur: off,
    onClick: p.phone
      ? () => {
          flashHighlight(key);
        }
      : undefined,
  };
}

export function GuessLine(p: RowProps): ReactElement {
  const { guess, state } = p;
  const comment = p.bare ? null : guess.comment;
  const parts: ReactNode = (
    <>
      <Who {...p} />
      <Value guess={guess} />
      <Answer guess={guess} state={state} now={p.now} />
    </>
  );
  // `data-own` says whose row it is (the tests find the viewer's rows by it); `data-solo`
  // turns the own colour off where every row is the viewer's.
  const row = {
    className: 'round-row',
    'data-own': guess.playerId === null,
    'data-solo': p.solo || undefined,
    'data-tier': guess.tier ?? undefined,
    ...useRowHighlight(p),
  };
  if (p.phone && comment !== null) {
    return (
      <li {...row}>
        <button type="button" className="round-row-line" aria-expanded={p.open} onClick={p.toggle}>
          {parts}
        </button>
        {p.open ? <span className="round-comment">{comment}</span> : null}
      </li>
    );
  }
  return (
    <li {...row}>
      <span className="round-row-line">
        {parts}
        {comment === null ? null : (
          <span className="round-comment" title={comment}>
            {comment}
          </span>
        )}
      </span>
    </li>
  );
}

// An event: a quiet line with the player's dot, or the special's row in the season colour
// with its icon (Leaf Fall, T115).
export function EventLine(p: {
  readonly line: FeedLine;
  readonly state: RoundStateView;
}): ReactElement {
  if (p.line.special === true) {
    return (
      <li className="round-row round-row--event round-row--special" data-testid="special-row">
        <span className="round-row-icon" aria-hidden="true">
          <SeasonIcon season={p.state.season} size="1rem" />
        </span>
        <span>{p.line.text}</span>
      </li>
    );
  }
  return (
    <li className="round-row round-row--event">
      <span className="round-dot" aria-hidden="true" style={dot(p.state, p.line.playerId)} />
      <span>{p.line.text}</span>
    </li>
  );
}
