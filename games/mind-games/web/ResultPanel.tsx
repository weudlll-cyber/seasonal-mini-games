/**
 * @file   games/mind-games/web/ResultPanel.tsx
 * @module games/mind-games/web
 * @brief  The result: the headline, its line, and the options as cards in one row with their
 *         players.
 *
 * Responsibility: the result's first part (02e §9, owner decisions O97 and the design of
 *                 MG-N7), the platform drawing nothing of its own around it (`ownResult`,
 *                 T352): the headline ("Winter wins!", "Spring and Winter win!", "Nobody wins
 *                 this round."), under it on its own line the place in words, the winners and
 *                 the points ("Least chosen season · 1 player wins 1 point"); then the round's
 *                 options as cards in one row, always, each a centred stack of its icon, its
 *                 name, its final count, its tag and its players (./CardPlayers: three names,
 *                 "You" first, then "+N more"). A winning card has a thick frame and a glow in
 *                 its season's colour with the pill "✓ wins", never by colour alone, and lights
 *                 up for about 2 s with the platform's win glow (02e §11.1; not with reduced
 *                 motion); the others are dimmed with their reason ("not least chosen", "not
 *                 chosen"). Its second part:
 *                 every line the feed showed, oldest first; never a hidden switch or a pre-pick
 *                 (02e §6.3, §7).
 * Depends on:     react, @smg/game-sdk (ResultPanelProps), @smg-game/mind-games (options,
 *                 names, words, views), ./CardPlayers, ./seasons, ./text; the win glow `smg-anim-win` of
 *                 @smg/ui motion.css, which the player client loads
 * Used by:        ./index
 * Spec:           docs/spec/02e-game-mind-games.md §8, §9
 */
import {
  CHOICE_NAMES,
  optionsOf,
  resultLine,
  resultTitle,
  whyNot,
  type Choice,
  type ResultView,
} from '@smg-game/mind-games';
import type { ResultPanelProps } from '@smg/game-sdk';
import { useEffect, useState, type ReactElement } from 'react';

import { CardPlayers } from './CardPlayers.js';
import { colorOf, iconsOf } from './seasons.js';
import { lineText } from './text.js';

type Names = Readonly<Record<string, string>>;

// How long the winning options light up (02e §11.1, about 2 s): one cycle of the glow.
export const LIGHT_MS = 2_400;

function OptionCard(p: {
  readonly r: ResultView;
  readonly c: Choice;
  readonly names: Names;
  readonly viewerKey: string | null;
  readonly lit: boolean;
}): ReactElement {
  const { r, c } = p;
  const wins = r.winners.includes(c);
  return (
    <li
      data-choice={c}
      data-wins={wins}
      className={wins && p.lit ? 'mg-option smg-anim-win' : 'mg-option'}
      style={{ ['--mg-color' as string]: colorOf(c) }}
    >
      <span className="mg-icons" aria-hidden="true">
        {iconsOf(c).map((src) => (
          <img key={src} src={src} alt="" />
        ))}
      </span>
      <strong className="mg-name">{CHOICE_NAMES[c]}</strong>
      <span className="mg-option-count">{r.counts[c]}</span>
      {wins ? (
        <span className="mg-wins">✓ wins</span>
      ) : (
        <span className="mg-option-why">{whyNot(r, c)}</span>
      )}
      <CardPlayers r={r} c={c} names={p.names} viewerKey={p.viewerKey} />
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

// The winners light up for about 2 s once the result shows; not with reduced motion.
function useLit(): boolean {
  const [lit, setLit] = useState(
    () =>
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLit(false);
    }, LIGHT_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);
  return lit;
}

export function ResultPanel(p: ResultPanelProps): ReactElement {
  const r = p.view as ResultView;
  const lit = useLit();
  if (p.part === 'history') return <History r={r} names={p.names} viewerKey={p.viewerKey} />;
  const options = optionsOf(r.rules.allOption);
  const line = resultLine(r);
  return (
    <div className="mg-result" data-testid="mind-result">
      <header className="mg-result-head">
        <h1 data-testid="result-title">{resultTitle(r)}</h1>
        {line === null ? null : <p data-testid="result-line">{line}</p>}
      </header>
      <ul
        className="mg-options"
        aria-label="The options"
        style={{ ['--mg-options' as string]: String(options.length) }}
      >
        {options.map((c) => (
          <OptionCard key={c} r={r} c={c} names={p.names} viewerKey={p.viewerKey} lit={lit} />
        ))}
      </ul>
    </div>
  );
}
