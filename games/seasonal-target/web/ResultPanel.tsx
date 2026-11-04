/**
 * @file   games/seasonal-target/web/ResultPanel.tsx
 * @module games/seasonal-target/web
 * @brief  The game's part of the result page: the target on the whole grid, and every guess.
 *
 * Responsibility: the reveal (`part`, T150), a flex column in the result screen's box: the
 *                 whole grid again (./TileGrid),
 *                 square and as tall as the box leaves free like the round's (O51, the same
 *                 `.st-board` and `useTileSize`), with the target tile marked by a ring and
 *                 "Target: column 12, row 10" in text, every guess of the round on its tile
 *                 (coloured by its answer, the viewer's framed, the others' with their corner
 *                 mark), the heat legend and the fallen tiles (02d §9); in individual mode the
 *                 viewer's own target and guesses on the grid (another player's answers are
 *                 about their own target). The history: every player's guesses in text (in
 *                 individual mode with their target), the viewer's line first, "did not guess"
 *                 without one. The platform shows placings, points, margin and the proof around it.
 * Depends on:     react, @smg/game-sdk (props), @smg-game/seasonal-target (types), ./heat,
 *                 ./HeatLegend, ./measure, ./TileGrid, ./words
 * Used by:        ./index
 * Spec:           docs/spec/02d-game-seasonal-target.md §9
 */
import type { ResultView } from '@smg-game/seasonal-target';
import { NO_GUESSES, type ResultPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { tilesOf, type Shot } from './heat.js';
import { HeatLegend } from './HeatLegend.js';
import { readable, useTileSize } from './measure.js';
import { TileGrid } from './TileGrid.js';
import { cellText, cellWords, shortAnswer } from './words.js';
import { marksFor } from './players.js';

// The guesses on the grid: everyone's with a shared target, the viewer's own with their own.
function resultShots(v: ResultView, viewer: string | null): Shot[] {
  const players = Object.entries(v.guesses).filter(([id]) => v.target !== null || id === viewer);
  return players.flatMap(([playerId, gs]) =>
    gs.map((g) => ({ cell: g.value, own: playerId === viewer, playerId, feedback: g.feedback })),
  );
}

// Every player's guesses in text, the viewer's line first.
function History({ view, names, viewerKey }: ResultPanelProps): ReactElement {
  const v = view as ResultView;
  const players = Object.keys(v.guesses).sort(
    (a, b) => Number(b === viewerKey) - Number(a === viewerKey),
  );
  return (
    <ul className="st-players" aria-label="Every guess">
      {players.map((id) => (
        <li key={id} className={id === viewerKey ? 'st-you' : undefined}>
          <strong className="smg-one-line" title={names[id] ?? id}>
            {names[id] ?? id}
          </strong>
          {v.targets?.[id] === undefined ? null : <> — target {cellText(v.targets[id])}</>}:{' '}
          {(v.guesses[id] ?? [])
            .map((g) => `${cellText(g.value)} ${shortAnswer(g.feedback)}`)
            .join(', ') || NO_GUESSES}
        </li>
      ))}
    </ul>
  );
}

// The round's answer mode, as its answers show it (the result view names none); five steps
// without a wrong answer.
function modeOf(v: ResultView): 'closeness' | 'distance' {
  const answers = Object.values(v.guesses).flat();
  return answers.some((g) => g.feedback.kind === 'closeness') ? 'closeness' : 'distance';
}

// The grid with the target, every guess, the legend of the round's mode.
function Reveal(props: ResultPanelProps): ReactElement {
  const { view, viewerKey } = props;
  const v = view as ResultView;
  const size = useTileSize(v.map.width);
  const target = v.target ?? (viewerKey === null ? null : (v.targets?.[viewerKey] ?? null));
  return (
    <div className="st-result" data-testid="st-result">
      {target === null ? null : (
        <p className="st-secret" data-testid="secret">
          Target: {cellWords(target)}
        </p>
      )}
      <div className="st-board">
        <TileGrid
          map={v.map}
          area={null}
          quarters={null}
          fallen={v.fallen}
          tiles={tilesOf(resultShots(v, viewerKey), props)}
          marks={marksFor(props)}
          variant="board"
          numbers={readable(size.px)}
          tags={readable(size.px)}
          gridRef={size.ref}
          target={target}
          label="The grid with the target and every guess."
        />
      </div>
      <HeatLegend mode={modeOf(v)} />
    </div>
  );
}

export function ResultPanel(props: ResultPanelProps): ReactElement {
  return props.part === 'reveal' ? <Reveal {...props} /> : <History {...props} />;
}
