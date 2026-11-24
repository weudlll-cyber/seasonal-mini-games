/**
 * @file   apps/web/src/round/ClosestToWinning.tsx
 * @module web/round
 * @brief  The result's "Closest to winning": ten players, each once with their best guess.
 *
 * Responsibility: the rows the server ordered (`state.closest`, O110), each in the game's
 *                 words (`text.best`): the rank, the player's dot (their team's colour, or their
 *                 roster colour), the name (cut at its end where the row is short, the tooltip
 *                 has it all), the guess as the round's list draws it and how close it came;
 *                 a solve ("found it") on the round's season's tint. On a desktop two columns of five,
 *                 1–5 down the left one, 6–10 down the right (./closest.css); on a phone one.
 *                 "All guesses (N)" in its head opens every player's guesses in full (the
 *                 game's history, T150) in place of the rows, as "All placings" opens the
 *                 placings; "Closest only" closes it.
 * Depends on:     react, @smg/contracts, @smg-game/registry/web (types), ./GuessLine
 *                 (GuessValue), ./RoundSide (playerColor), ../season/season (seasonColor),
 *                 ./closest.css
 * Used by:        ./ResultScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §9
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { ClosestRowView, RoundStateView } from '@smg/contracts';
import { formatNumber, type BestLine } from '@smg/game-sdk';
import { useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';

import { GuessValue } from './GuessLine.js';
import { seasonColor } from '../season/season.js';
import { playerColor } from './RoundSide.js';
import './closest.css';

// The rows the game words; a row it cannot word is left out.
function linesOf(state: RoundStateView, game: GameWeb) {
  return (state.closest ?? []).flatMap((row) => {
    const line = game.text.best?.(state.game, row) ?? null;
    return line === null ? [] : [{ row, line }];
  });
}

function Row(p: {
  readonly state: RoundStateView;
  readonly rank: number;
  readonly row: ClosestRowView;
  readonly line: BestLine;
}): ReactElement {
  const name = p.state.names[p.row.playerId] ?? p.row.playerId;
  const dot = { '--dot': playerColor(p.state, p.row.playerId) } as CSSProperties;
  return (
    <li className="round-closest-row" data-found={p.row.distance === 0 || undefined}>
      <span className="round-closest-rank">{p.rank}</span>
      <span className="round-dot" aria-hidden="true" style={dot} />
      <span className="round-who" title={name}>
        {name}
      </span>
      <GuessValue guess={p.line.guess} />
      <span className="round-closest-words">{p.line.words}</span>
    </li>
  );
}

export function ClosestToWinning(p: {
  readonly state: RoundStateView;
  readonly game: GameWeb;
  // Every player's guesses in full (the game's history part), behind "All guesses".
  readonly history: ReactNode;
}): ReactElement {
  const [all, setAll] = useState(false);
  const lines = linesOf(p.state, p.game);
  const total = (p.state.results ?? []).reduce((n, r) => n + r.guesses, 0);
  return (
    <section
      className="smg-panel round-closest"
      aria-labelledby="closest-title"
      data-testid="result-closest"
      // A fixed part of the result's screen: it shows whole at the screen's scale (O111).
      data-sk-fit-fixed=""
      // The round's season, for a solve's tint (./closest.css).
      style={{ '--season': seasonColor(p.state.season) } as CSSProperties}
    >
      <header className="round-closest-head">
        <h2 id="closest-title">Closest to winning</h2>
        {total === 0 ? null : (
          <button
            type="button"
            className="smg-btn round-log-all round-all-guesses"
            aria-expanded={all}
            data-testid="all-guesses"
            onClick={() => {
              setAll((was) => !was);
            }}
          >
            {all ? 'Closest only' : `All guesses (${formatNumber(total)})`}
          </button>
        )}
      </header>
      {all ? (
        <div className="round-closest-all" data-testid="result-history">
          {p.history}
        </div>
      ) : lines.length === 0 ? (
        <p className="smg-muted">Nobody guessed this round.</p>
      ) : (
        <ol className="round-closest-rows" data-testid="closest">
          {lines.map((l, i) => (
            <Row key={l.row.playerId} state={p.state} rank={i + 1} row={l.row} line={l.line} />
          ))}
        </ol>
      )}
    </section>
  );
}
