/**
 * @file   games/seasonal-target/web/TargetInput.tsx
 * @module games/seasonal-target/web
 * @brief  The input row of Seasonal Target: the map with its selection, arrows, fields and Guess.
 *
 * Responsibility: the map of the player's target area (./MapBoard) with every dot the view
 *                 carries, the fallen cells and Spring's quarter; a local selection, set by a
 *                 click or tap, moved by the N/W/S/E buttons and the keyboard arrows with the
 *                 map focused, and by the compact Column and Row fields that follow it,
 *                 always clamped to the target area; "Selected: column 12, row 34" read out
 *                 live; the platform's cooldown ring at the row's start and a large Guess that
 *                 reads "Wait 6 s" during the cooldown (`buttonText`, T125; Enter on the map
 *                 guesses too). Dots in each player's list colour, named, with a legend. Nothing is sent before Guess (05 §3.1). A cell
 *                 outside the area, a fallen one or one already tried is refused at once with
 *                 its sentence, Guess staying enabled (02d §4, T113). Guess waits while a guess
 *                 is on its way (T76). The latest own answer stands in words under the row.
 * Depends on:     react, @smg/game-sdk (props, buttonText), @smg-game/seasonal-target (types,
 *                 helpers), ./dots, ./Legend, ./MapBoard, ./text, ./words
 * Used by:        ./index
 * Spec:           docs/spec/02d-game-seasonal-target.md §4, §11; docs/spec/05-security-threat-model.md §3.1
 */
import { inArea, sameCell, type Area, type Cell, type PlayerView } from '@smg-game/seasonal-target';
import { buttonText, type PlayerPanelProps } from '@smg/game-sdk';
import { useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';

import { playerDots } from './dots.js';
import { Legend } from './Legend.js';
import { MapBoard } from './MapBoard.js';
import { CODES } from './text.js';
import { cellWords, longAnswer } from './words.js';

export type StInputProps = PlayerPanelProps & { readonly ring?: ReactNode };

const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));
const within = (a: Area, c: Cell): Cell => ({
  x: clamp(c.x, a.left, a.right),
  y: clamp(c.y, a.top, a.bottom),
});
const middle = (a: Area): Cell => ({
  x: Math.floor((a.left + a.right) / 2),
  y: Math.floor((a.top + a.bottom) / 2),
});

const STEPS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

// The sentence for a cell the view already refuses (02d §4 checks 5–6), or null; the
// selection is always inside the target area, so check 4 needs no local test.
function localRefusal(v: PlayerView, c: Cell): string | null {
  if (v.fallen.some((f) => sameCell(f, c))) return CODES['CELL_REMOVED'] ?? null;
  if (v.repeatRejected && v.guesses.some((g) => sameCell(g.value, c))) {
    return CODES['ALREADY_GUESSED'] ?? null;
  }
  return null;
}

// The server's refusal in words: a cell on the map refused as `OUT_OF_MAP` lay outside the
// target area, which a halving had just shrunk before the view showed it (02d §4).
function refusalText(code: string | undefined, c: Cell, v: PlayerView): string | null {
  if (
    code === 'OUT_OF_MAP' &&
    inArea({ left: 1, right: v.map.width, top: 1, bottom: v.map.height }, c)
  ) {
    return CODES['OUT_OF_AREA'] ?? null;
  }
  return CODES[code ?? ''] ?? null;
}

function useTarget(view: PlayerView, act: PlayerPanelProps['act']) {
  const [raw, setRaw] = useState<Cell | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Clamped at every render, so a halving pulls the selection into the new area.
  const selected = within(view.area, raw ?? middle(view.area));
  const select = (c: Cell): void => {
    setRaw(within(view.area, c));
    setMessage(null);
  };
  const move = (dx: number, dy: number): void => {
    select({ x: selected.x + dx, y: selected.y + dy });
  };
  const guess = (): void => {
    const refused = localRefusal(view, selected);
    if (refused !== null) {
      setMessage(refused);
      return;
    }
    setSending(true);
    void act({ value: selected })
      .then((reply) => {
        setMessage(reply.ok ? null : refusalText(reply.code, selected, view));
      })
      .finally(() => {
        setSending(false);
      });
  };
  return { selected, select, move, guess, message, sending };
}

// One coordinate field: it shows the selection and sets it.
function Field(p: { label: string; value: number; set: (v: number) => void }): ReactElement {
  return (
    <label className="st-field">
      {p.label}
      <input
        className="smg-input"
        type="number"
        inputMode="numeric"
        value={p.value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isInteger(v) && e.target.value !== '') p.set(v);
        }}
      />
    </label>
  );
}

const ARROW_BUTTONS = [
  ['north', '↑', 0, -1],
  ['west', '←', -1, 0],
  ['east', '→', 1, 0],
  ['south', '↓', 0, 1],
] as const;

// The Column and Row fields and the arrow cross: both move the local selection.
function Steer(t: {
  readonly selected: Cell;
  readonly select: (c: Cell) => void;
  readonly move: (dx: number, dy: number) => void;
}): ReactElement {
  return (
    <>
      <div className="st-fields">
        <Field
          label="Column"
          value={t.selected.x}
          set={(x) => {
            t.select({ ...t.selected, x });
          }}
        />
        <Field
          label="Row"
          value={t.selected.y}
          set={(y) => {
            t.select({ ...t.selected, y });
          }}
        />
      </div>
      <div className="st-cross" role="group" aria-label="Move the selection">
        {ARROW_BUTTONS.map(([dir, glyph, dx, dy]) => (
          <button
            key={dir}
            type="button"
            className={`smg-btn st-move st-move--${dir}`}
            aria-label={`Move ${dir}`}
            onClick={() => {
              t.move(dx, dy);
            }}
          >
            {glyph}
          </button>
        ))}
      </div>
    </>
  );
}

export function TargetInput(props: StInputProps): ReactElement {
  const view = props.view as PlayerView;
  const t = useTarget(view, props.act);
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>): void => {
    const step = STEPS[e.key];
    if (step !== undefined) t.move(step[0], step[1]);
    else if (e.key === 'Enter' && props.canAct && !t.sending) t.guess();
    else return;
    e.preventDefault();
  };
  const last = view.guesses.at(-1)?.feedback ?? null;
  const dots = playerDots(view, props);
  return (
    <div className="st-input" data-testid="st-input">
      <MapBoard
        shown={view.area}
        dots={dots}
        fallen={view.fallen}
        quarter={view.hint}
        selection={t.selected}
        label="The map. Arrow keys move the selection, Enter guesses."
        onSelect={t.select}
        onKeyDown={onKeyDown}
      />
      <Legend dots={dots} />
      <div className="st-row">
        {props.ring}
        <p className="st-selected" aria-live="polite" data-testid="selected">
          Selected: {cellWords(t.selected)}
        </p>
        <Steer selected={t.selected} select={t.select} move={t.move} />
        <button
          type="button"
          className="smg-btn smg-btn--primary st-go"
          disabled={!props.canAct || t.sending}
          onClick={t.guess}
          data-testid="guess-button"
        >
          {buttonText('Guess', props.waitS)}
        </button>
      </div>
      {t.message === null ? null : (
        <p className="st-message" role="status">
          {t.message}
        </p>
      )}
      {last === null ? null : (
        <p className="st-last" data-testid="last-answer">
          Last guess: {longAnswer(last)}
        </p>
      )}
    </div>
  );
}
