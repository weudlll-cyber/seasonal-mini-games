/**
 * @file   games/seasonal-target/web/ResultPanel.tsx
 * @module games/seasonal-target/web
 * @brief  The game's part of the result page: the target on the whole map, and every guess.
 *
 * Responsibility: the whole map again with the target cell marked (a ring in the season
 *                 colour) and "Target: column 20, row 30" in text, every guess of the round as
 *                 a dot and the fallen cells (02d §9); in individual mode the viewer's own
 *                 target and dots on the map and every player's target in text, the viewer's
 *                 line first. The platform shows placings, points, margin and the proof around it.
 * Depends on:     react, @smg/game-sdk (props), @smg-game/seasonal-target (types), ./dots,
 *                 ./MapBoard, ./words
 * Used by:        ./index
 * Spec:           docs/spec/02d-game-seasonal-target.md §9
 */
import type { ResultView } from '@smg-game/seasonal-target';
import type { ResultPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { dotsOf } from './dots.js';
import { MapBoard } from './MapBoard.js';
import { cellText, cellWords, shortAnswer } from './words.js';

// Every guess as a dot: the viewer's ringed, the others' in their colours.
function resultDots(v: ResultView, names: ResultPanelProps['names'], viewer: string | null) {
  let seq = 0;
  const seen = (value: ResultView['guesses'][string][number]) => {
    seq += 1;
    return { receiveSeq: seq, value: value.value, feedback: value.feedback };
  };
  const own = viewer === null ? [] : (v.guesses[viewer] ?? []).map(seen);
  const log = Object.entries(v.guesses)
    .filter(([id]) => id !== viewer)
    .flatMap(([playerId, gs]) => gs.map((g) => ({ ...seen(g), playerId })));
  return dotsOf(own, log, names);
}

export function ResultPanel({ view, names, viewerKey }: ResultPanelProps): ReactElement {
  const v = view as ResultView;
  const target = v.target ?? (viewerKey === null ? null : (v.targets?.[viewerKey] ?? null));
  const players = Object.keys(v.guesses).sort(
    (a, b) => Number(b === viewerKey) - Number(a === viewerKey),
  );
  return (
    <div className="st-result" data-testid="st-result">
      {target === null ? null : (
        <p className="st-secret" data-testid="secret">
          Target: {cellWords(target)}
        </p>
      )}
      <MapBoard
        shown={{ left: 1, right: v.map.width, top: 1, bottom: v.map.height }}
        dots={resultDots(v, names, viewerKey)}
        fallen={v.fallen}
        target={target}
        label="The map with the target and every guess."
      />
      <ul className="st-players" aria-label="Every guess">
        {players.map((id) => (
          <li key={id} className={id === viewerKey ? 'st-you' : undefined}>
            <strong>{names[id] ?? id}</strong>
            {v.targets?.[id] === undefined ? null : <> — target {cellText(v.targets[id])}</>}:{' '}
            {(v.guesses[id] ?? [])
              .map((g) => `${cellText(g.value)} ${shortAnswer(g.feedback)}`)
              .join(', ') || 'no guesses'}
          </li>
        ))}
      </ul>
    </div>
  );
}
