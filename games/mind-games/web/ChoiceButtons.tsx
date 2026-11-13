/**
 * @file   games/mind-games/web/ChoiceButtons.tsx
 * @module games/mind-games/web
 * @brief  The four or five choice buttons with the feed's count and bar under each.
 *
 * Responsibility: one row of large buttons, each in its season's colour with its original icon
 *                 and name (All in the neutral colour with the four icons), as a radio group:
 *                 the arrow keys move between them, Enter or Space chooses (02e §11). The
 *                 viewer's current choice is pressed, with a check and "Your choice" in words,
 *                 never by colour alone; choosing it again sends nothing. Under each button its
 *                 count as the feed shows it, "30 s ago: 7", with a bar of that length; the
 *                 count is the view's, never a live one, and the client counts nothing. Every
 *                 button has its tooltip (O89). Between the buttons and the counts runs the
 *                 flight band (./FlightBand, 02e §11.1). A spectator gets the same row without
 *                 choosing.
 * Depends on:     react, @smg-game/mind-games (options, names, views), ./FlightBand, ./seasons,
 *                 ./text
 * Used by:        ./MindInput, ./FeedPanels
 * Spec:           docs/spec/02e-game-mind-games.md §6.1, §11
 */
import { CHOICE_NAMES, optionsOf, type Choice, type SpectatorView } from '@smg-game/mind-games';
import { useRef, useState, type KeyboardEvent, type ReactElement } from 'react';

import { FlightBand } from './FlightBand.js';
import { colorOf, iconsOf } from './seasons.js';
import { clock, delayS } from './text.js';

export interface ChoiceButtonsProps {
  readonly view: SpectatorView;
  // The viewer's current choice, live; null without one (and for a spectator).
  readonly own: Choice | null;
  // Null: a spectator's row, which shows the counts only.
  readonly choose: ((c: Choice) => void) | null;
  readonly canAct: boolean;
  readonly names: Readonly<Record<string, string>>;
}

const STEP: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

export const tooltipOf = (c: Choice, view: SpectatorView): string =>
  `Choose ${CHOICE_NAMES[c]}. You can switch until ${clock(view.rules.plan.actionsEndMs)}.`;

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

// The feed's count under each button, with a bar of its length among the options.
function Counts(p: { readonly view: SpectatorView; readonly options: readonly Choice[] }) {
  const { view, options } = p;
  const most = Math.max(1, ...options.map((c) => view.counts[c]));
  const ago = `${String(delayS(view))} s ago`;
  return (
    <div className="mg-counts">
      {options.map((c) => (
        <p
          key={c}
          className="mg-count"
          data-choice={c}
          data-testid={`count-${c}`}
          style={{ ['--mg-color' as string]: colorOf(c) }}
        >
          <span>
            {ago}: <strong>{view.counts[c]}</strong>
          </span>
          <span
            className="mg-bar"
            aria-hidden="true"
            style={{ width: `${String((view.counts[c] / most) * 100)}%` }}
          />
        </p>
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
            style={{ ['--mg-color' as string]: colorOf(c) }}
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
      <FlightBand view={view} names={p.names} />
      <Counts view={view} options={options} />
    </div>
  );
}
