/**
 * @file   games/seasonal-target/web/TargetInput.tsx
 * @module games/seasonal-target/web
 * @brief  The input of Seasonal Target: the tile grid with its selection, the loupe, and Guess.
 *
 * Responsibility: the whole grid (./TileGrid) drawn through a portal into the round's stage
 *                 (`stage`, the left column at full height, O51; inline before the controls
 *                 without one), as large as the stage allows, with every guess the view
 *                 carries, the fallen tiles, Spring's quarter and the target area; a local
 *                 selection, set by a click or tap, moved by the keyboard arrows with the grid
 *                 focused (Enter guesses) and by the Column and Row fields and the arrow
 *                 buttons behind "Type coordinates" (./Steer). A fallen tile or one outside the
 *                 target area is never selected (a click, the loupe, the fields): the
 *                 selection stays and the view says "That tile fell." or that it is outside;
 *                 the arrows (keys and buttons) step past fallen tiles and stop at the area's
 *                 edge; Guess is disabled while the selected tile cannot be guessed, e.g. once
 *                 it fell (T151). On a phone whose tiles are under 44 px the first tap opens the loupe
 *                 (./Loupe) and the fields and arrows live only there; with larger tiles a tap
 *                 selects directly. The controls stay in the input row of the right column, top
 *                 to bottom: "Selected: column 12, row 7", read out live; the platform's
 *                 cooldown ring and a large Guess, which reads "Wait 6 s" during the cooldown
 *                 (`buttonText`, T125), waits while a guess is on its way (T76) and closes the
 *                 loupe; a refusal; the coordinate toggle. Nothing is sent before Guess
 *                 (05 §3.1). A tile already tried is refused at once with its sentence, Guess
 *                 staying enabled (02d §4, T113).
 * Depends on:     react, react-dom (createPortal), @smg/game-sdk (props, buttonText),
 *                 @smg-game/seasonal-target (types, helpers), ./heat, ./Loupe, ./measure,
 *                 ./Steer, ./text, ./TileGrid, ./words
 * Used by:        ./index
 * Spec:           docs/spec/02d-game-seasonal-target.md §4, §11; docs/spec/05-security-threat-model.md §3.1
 */
import { inArea, sameCell, type Area, type Cell, type PlayerView } from '@smg-game/seasonal-target';
import { buttonText, type PlayerPanelProps } from '@smg/game-sdk';
import { useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { shotsOf, tilesOf } from './heat.js';
import { Loupe, useLoupe } from './Loupe.js';
import { readable, TOUCH_PX, useCompact, useTileSize } from './measure.js';
import { TypedSteer } from './Steer.js';
import { CODES } from './text.js';
import { TileGrid } from './TileGrid.js';
import { cellWords } from './words.js';

// The platform's cooldown ring for the row, and the round's stage the board is drawn into (O51).
export type StInputProps = PlayerPanelProps & {
  readonly ring?: ReactNode;
  readonly stage?: HTMLElement | null;
};

const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));
const within = (a: Area, c: Cell): Cell => ({
  x: clamp(c.x, a.left, a.right),
  y: clamp(c.y, a.top, a.bottom),
});
const middle = (a: Area): Cell => ({
  x: Math.floor((a.left + a.right) / 2),
  y: Math.floor((a.top + a.bottom) / 2),
});

type Step = readonly [number, number];

const STEPS: Readonly<Record<string, Step>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

// Why a tile cannot be selected (T151), or null: it fell, or it lies outside the target area.
export const FELL = 'That tile fell.';
function unselectable(v: PlayerView, c: Cell): string | null {
  if (!inArea(v.area, c)) return CODES['OUT_OF_AREA'] ?? null;
  return v.fallen.some((f) => sameCell(f, c)) ? FELL : null;
}

// The tile an arrow reaches from `c`: the next one inside the area that has not fallen, or
// null at the area's edge.
function stepFrom(v: PlayerView, c: Cell, [dx, dy]: Step): Cell | null {
  for (
    let at = { x: c.x + dx, y: c.y + dy };
    inArea(v.area, at);
    at = { x: at.x + dx, y: at.y + dy }
  ) {
    if (unselectable(v, at) === null) return at;
  }
  return null;
}

// The sentence for a tile already tried where repeats are refused (02d §4 check 6), or null.
function localRefusal(v: PlayerView, c: Cell): string | null {
  if (v.repeatRejected && v.guesses.some((g) => sameCell(g.value, c))) {
    return CODES['ALREADY_GUESSED'] ?? null;
  }
  return null;
}

// The server's refusal in words: a tile on the grid refused as `OUT_OF_MAP` lay outside the
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
  // A selected tile that fell since (or the first one, fallen already) cannot be guessed.
  const blocked = unselectable(view, selected);
  // Selects `c`, or with an arrow's `step` the next free tile that way; a fallen tile or one
  // outside the area keeps the selection and says why. Returns the selection after it.
  const select = (c: Cell, step?: Step): Cell => {
    const next = step === undefined ? c : stepFrom(view, selected, step);
    const why = next === null ? null : unselectable(view, next);
    if (next === null || why !== null) {
      setMessage(why);
      return selected;
    }
    setRaw(next);
    setMessage(null);
    return next;
  };
  const guess = (): void => {
    if (blocked !== null) return;
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
  return { selected, select, guess, message: blocked ?? message, blocked, sending };
}

// The selection with every way to move it: the grid's clicks and keys, the loupe, Guess.
function useAim(view: PlayerView, props: StInputProps) {
  const t = useTarget(view, props.act);
  const size = useTileSize(view.map.width);
  const compact = useCompact();
  const loupe = useLoupe(view.map);
  // A phone whose tiles are smaller than a finger aims through the loupe.
  const viaLoupe = compact && size.px !== null && size.px < TOUCH_PX;
  const guess = (): void => {
    t.guess();
    if (loupe.sheet.open) loupe.sheet.close();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const step = STEPS[e.key];
    if (step !== undefined) t.select(t.selected, step);
    else if (e.key === 'Enter' && props.canAct && !t.sending) guess();
    else return;
    e.preventDefault();
  };
  const onTile = (c: Cell): void => {
    const next = t.select(c);
    if (viaLoupe) loupe.show(next);
  };
  const pick = (c: Cell, step?: Step): void => {
    loupe.follow(t.select(c, step));
  };
  return { t, size, compact, loupe, guess, onKeyDown, onTile, pick };
}

// The grid with the loupe over it: drawn into the round's stage, or here without one.
function Board(p: {
  readonly stage: HTMLElement | null | undefined;
  readonly children: ReactNode;
}): ReactElement {
  const board = <div className="st-board">{p.children}</div>;
  return p.stage == null ? board : createPortal(board, p.stage);
}

export function TargetInput(props: StInputProps): ReactElement {
  const view = props.view as PlayerView;
  const { t, size, compact, loupe, guess, onKeyDown, onTile, pick } = useAim(view, props);
  const grid = {
    map: view.map,
    area: view.area,
    quarters: view.hint,
    fallen: view.fallen,
    tiles: tilesOf(shotsOf(view.guesses, view.log), props),
  };
  return (
    <>
      <Board stage={props.stage}>
        <TileGrid
          {...grid}
          variant="board"
          numbers={readable(size.px)}
          selected={t.selected}
          gridRef={size.ref}
          label="The grid. Arrow keys move the selection, Enter guesses."
          onTile={onTile}
          onKeyDown={onKeyDown}
        />
        <Loupe loupe={loupe} grid={grid} selected={t.selected} pick={pick} />
      </Board>
      <div className="st-input" data-testid="st-input">
        <p className="st-selected" aria-live="polite" data-testid="selected">
          Selected: {cellWords(t.selected)}
        </p>
        <div className="st-row">
          {props.ring}
          <button
            type="button"
            className="smg-btn smg-btn--primary st-go"
            disabled={!props.canAct || t.sending || t.blocked !== null}
            onClick={guess}
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
        {/* A phone aims through the loupe, which holds its own fields. */}
        {compact ? null : <TypedSteer selected={t.selected} select={t.select} />}
      </div>
    </>
  );
}
