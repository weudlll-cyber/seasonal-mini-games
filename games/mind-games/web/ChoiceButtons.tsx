/**
 * @file   games/mind-games/web/ChoiceButtons.tsx
 * @module games/mind-games/web
 * @brief  The choice cards: four or five in one row, each with its button and the feed's count.
 *
 * Responsibility: one row of cards (owner decision O97), each in its season's colour (All in
 *                 the neutral colour with the four icons): on top the button with the season's
 *                 original icon and its name, a radio group (the arrow keys move between them,
 *                 Enter or Space chooses, 02e §11), whose click area is the whole card, its band
 *                 and its count included (./mind.css); at the foot the count as the feed shows it,
 *                 in large type, with "players, 10 s ago" under it; the count is the view's,
 *                 never a live one, and the client counts nothing; while the feed is still
 *                 empty there is no count at all (09 §4 journey 38). The viewer's current choice
 *                 has a strong frame in its colour and the pill "✓ Your choice", never colour
 *                 alone; choosing it again sends nothing. On a phone a card shows the icon, the
 *                 name and the count, and one line under the row names the choice ("Your
 *                 choice: Autumn", ./mind.css). Every button has its tooltip (O89). Between the
 *                 buttons and the counts, inside the cards' frames, runs the flight band
 *                 (./FlightBand, 02e §11.1, given the round's timing), which no button
 *                 overlaps. A spectator gets the same row without choosing.
 * Depends on:     react, @seasonal/kit (clockText), @smg/game-sdk (PhasedTiming), @smg-game/mind-games (options, names,
 *                 views), ./FlightBand, ./seasons, ./text
 * Used by:        ./MindInput, ./FeedPanels
 * Spec:           docs/spec/02e-game-mind-games.md §6.1, §11
 */
import { CHOICE_NAMES, optionsOf, type Choice, type SpectatorView } from '@smg-game/mind-games';
import { clockText } from '@seasonal/kit';
import type { PhasedTiming } from '@smg/game-sdk';
import { useRef, useState, type KeyboardEvent, type ReactElement } from 'react';

import { FlightBand } from './FlightBand.js';
import { colorOf, iconsOf } from './seasons.js';
import { delayS } from './text.js';

interface ChoiceButtonsProps {
  readonly view: SpectatorView;
  // The viewer's current choice, live; null without one (and for a spectator).
  readonly own: Choice | null;
  // Null: a spectator's row, which shows the counts only.
  readonly choose: ((c: Choice) => void) | null;
  readonly canAct: boolean;
  readonly names: Readonly<Record<string, string>>;
  // The round's public timing: the flights shorten near its end (02e §11.1).
  readonly timing?: PhasedTiming | undefined;
}

const STEP: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

const tooltipOf = (c: Choice, view: SpectatorView): string =>
  `Choose ${CHOICE_NAMES[c]}. You can switch until ${clockText(view.rules.plan.actionsEndMs)}.`;

const tint = (c: Choice) => ({ ['--mg-color' as string]: colorOf(c) });

function Icons(p: { readonly choice: Choice }): ReactElement {
  return (
    <span className="mg-icons" aria-hidden="true">
      {iconsOf(p.choice).map((src) => (
        <img key={src} src={src} alt="" />
      ))}
    </span>
  );
}

// Roving focus over the row (one tab stop, the arrows move it).
function useRoving(count: number, start: number) {
  const [focus, setFocus] = useState(start);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent): void => {
    const step = STEP[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = (focus + step + count) % count;
    setFocus(next);
    refs.current[next]?.focus();
  };
  return { focus, setFocus, refs, onKeyDown };
}

// The feed's count at each card's foot: the number large, "players, 10 s ago" under it.
function Counts(p: { readonly view: SpectatorView; readonly options: readonly Choice[] }) {
  const { view, options } = p;
  // Before anything is one delay old the feed is empty: no count yet, the row keeps its place.
  if (view.entrants === 0 && view.lines.length === 0) {
    return <div className="mg-counts mg-counts--waiting" aria-hidden="true" />;
  }
  const ago = `${String(delayS(view))} s ago`;
  return (
    <div className="mg-counts">
      {options.map((c) => (
        <p key={c} className="mg-count" data-choice={c} data-testid={`count-${c}`}>
          <strong className="mg-count-n">{view.counts[c]}</strong>{' '}
          <span className="mg-count-ago">
            {view.counts[c] === 1 ? 'player' : 'players'}, {ago}
          </span>
        </p>
      ))}
    </div>
  );
}

// The cards' frames behind the buttons, the band and the counts: one per option, the own
// choice's strong.
function Frames(p: { readonly options: readonly Choice[]; readonly own: Choice | null }) {
  return (
    <div className="mg-frames" aria-hidden="true">
      {p.options.map((c) => (
        <span key={c} className="mg-frame" data-choice={c} data-own={p.own === c} style={tint(c)} />
      ))}
    </div>
  );
}

export function ChoiceButtons(p: ChoiceButtonsProps): ReactElement {
  const { view, own } = p;
  const options = optionsOf(view.rules.allOption);
  const roving = useRoving(options.length, Math.max(0, own === null ? 0 : options.indexOf(own)));
  return (
    <div className="mg-choices" style={{ ['--mg-options' as string]: String(options.length) }}>
      <Frames options={options} own={own} />
      <div
        className="mg-buttons"
        role="radiogroup"
        aria-label="Your choice"
        onKeyDown={roving.onKeyDown}
      >
        {options.map((c, i) => (
          <button
            key={c}
            ref={(el) => {
              roving.refs.current[i] = el;
            }}
            type="button"
            role="radio"
            className="mg-choice"
            data-choice={c}
            style={tint(c)}
            aria-checked={own === c}
            tabIndex={i === roving.focus ? 0 : -1}
            disabled={p.choose === null || !p.canAct}
            title={tooltipOf(c, view)}
            onFocus={() => {
              roving.setFocus(i);
            }}
            onClick={() => {
              if (own !== c) p.choose?.(c);
            }}
          >
            <Icons choice={c} />
            <span className="mg-name">{CHOICE_NAMES[c]}</span>
            {own === c ? <span className="mg-yours">✓ Your choice</span> : null}
          </button>
        ))}
      </div>
      <FlightBand view={view} names={p.names} timing={p.timing} />
      <Counts view={view} options={options} />
    </div>
  );
}
