/**
 * @file   games/mind-games/web/ResultPanel.tsx
 * @module games/mind-games/web
 * @brief  The result: the options with counts, places and winners, the players under each.
 *
 * Responsibility: the result's first part (02e §9): the round's options in a row, each with its
 *                 icon, its count and its place ("least chosen", "2nd least chosen", none for an
 *                 option nobody chose); the winning ones marked by a check and "wins", never by
 *                 colour alone; under each option the players whose final choice it was, the
 *                 viewer's own line highlighted, each winner with "+1" or "+2". The headline is
 *                 the platform's line in the result's header (./text `runnerUp`). Its second
 *                 part: every line the feed showed, oldest first; never a hidden switch or a
 *                 pre-pick (02e §6.3, §7).
 * Depends on:     react, @smg/game-sdk (ResultPanelProps), @smg-game/mind-games (options,
 *                 names, places, views), ./seasons, ./text
 * Used by:        ./index
 * Spec:           docs/spec/02e-game-mind-games.md §8, §9
 */
import {
  CHOICE_NAMES,
  optionsOf,
  placeWords,
  type Choice,
  type ResultView,
} from '@smg-game/mind-games';
import type { ResultPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { colorOf, iconsOf } from './seasons.js';
import { lineText } from './text.js';

type Names = Readonly<Record<string, string>>;

function OptionCard(p: {
  readonly r: ResultView;
  readonly c: Choice;
  readonly names: Names;
  readonly viewerKey: string | null;
}): ReactElement {
  const { r, c } = p;
  const wins = r.winners.includes(c);
  const place = r.places[c];
  const players = r.players.filter((x) => x.choice === c);
  return (
    <li
      className="mg-option"
      data-choice={c}
      data-wins={wins}
      style={{ ['--mg-color' as string]: colorOf(c) }}
    >
      <span className="mg-icons" aria-hidden="true">
        {iconsOf(c).map((src) => (
          <img key={src} src={src} alt="" />
        ))}
      </span>
      <strong className="mg-name">{CHOICE_NAMES[c]}</strong>
      <span className="mg-option-count">{r.counts[c]}</span>
      <span className="mg-option-place">{place === null ? 'not chosen' : placeWords(place)}</span>
      {wins ? <span className="mg-wins">✓ wins</span> : null}
      <ul className="mg-option-players" aria-label={`Chose ${CHOICE_NAMES[c]}`}>
        {players.map((x) => (
          <li key={x.playerKey} data-own={x.playerKey === p.viewerKey}>
            {x.playerKey === p.viewerKey ? 'You' : (p.names[x.playerKey] ?? x.playerKey)}
            {x.points > 0 ? <span className="mg-points"> +{x.points}</span> : null}
          </li>
        ))}
      </ul>
    </li>
  );
}

function History(p: {
  readonly r: ResultView;
  readonly names: Names;
  readonly viewerKey: string | null;
}) {
  const lines = [...p.r.lines].reverse();
  if (lines.length === 0) return <p className="smg-muted">Nobody chose this round.</p>;
  return (
    <ol className="mg-history">
      {lines.map((l) => (
        <li key={`${String(l.at)}:${l.playerKey}`}>
          {l.playerKey === p.viewerKey ? 'You' : (p.names[l.playerKey] ?? l.playerKey)}{' '}
          {lineText(l)}
        </li>
      ))}
    </ol>
  );
}

export function ResultPanel(p: ResultPanelProps): ReactElement {
  const r = p.view as ResultView;
  if (p.part === 'history') return <History r={r} names={p.names} viewerKey={p.viewerKey} />;
  return (
    <ul className="mg-options" aria-label="The options" data-testid="mind-result">
      {optionsOf(r.rules.allOption).map((c) => (
        <OptionCard key={c} r={r} c={c} names={p.names} viewerKey={p.viewerKey} />
      ))}
    </ul>
  );
}
