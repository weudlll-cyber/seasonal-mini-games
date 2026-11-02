/**
 * @file   games/seasonal-target/web/TargetInput.tsx
 * @module games/seasonal-target/web
 * @brief  The input of Seasonal Target: the tile grid with its selection, the loupe, and Guess.
 *
 * Responsibility: the whole grid (./TileGrid) as large as the input's box allows, with every
 *                 guess the view carries, the fallen tiles, Spring's quarter and the target
 *                 area; a local selection, set by a click or tap, moved by the keyboard arrows
 *                 with the grid focused (Enter guesses) and by the Column and Row fields and the
 *                 arrow buttons (./Steer), always clamped to the target area. On a phone whose
 *                 tiles are under 44 px the first tap opens the loupe (./Loupe) and the fields
 *                 and arrows live only there; with larger tiles a tap selects directly.
 *                 "Selected: column 12, row 7" stands beside a large Guess, read out live, the
 *                 platform's cooldown ring at the row's start; Guess reads "Wait 6 s" during
 *                 the cooldown (`buttonText`, T125), waits while a guess is on its way (T76) and
 *                 closes the loupe. Nothing is sent before Guess (05 §3.1). A tile outside the
 *                 area, a fallen one or one already tried is refused at once with its sentence,
 *                 Guess staying enabled (02d §4, T113). The latest own answer stands in words
 *                 under the row, the heat legend above it.
 * Depends on:     react, @smg/game-sdk (props, buttonText), @smg-game/seasonal-target (types,
 *                 helpers), ./heat, ./HeatLegend, ./Loupe, ./measure, ./Steer, ./text,
 *                 ./TileGrid, ./words
 * Used by:        ./index
 * Spec:           docs/spec/02d-game-seasonal-target.md §4, §11; docs/spec/05-security-threat-model.md §3.1
 */
import { inArea, sameCell, type Area, type Cell, type PlayerView } from '@smg-game/seasonal-target';
import { buttonText, type PlayerPanelProps } from '@smg/game-sdk';
import { useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';

import { shotsOf, tilesOf } from './heat.js';
import { HeatLegend } from './HeatLegend.js';
import { Loupe, useLoupe } from './Loupe.js';
import { readable, TOUCH_PX, useCompact, useTileSize } from './measure.js';
import { Steer } from './Steer.js';
import { CODES } from './text.js';
import { TileGrid } from './TileGrid.js';
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

// The sentence for a tile the view already refuses (02d §4 checks 5–6), or null; the
// selection is always inside the target area, so check 4 needs no local test.
function localRefusal(v: PlayerView, c: Cell): string | null {
  if (v.fallen.some((f) => sameCell(f, c))) return CODES['CELL_REMOVED'] ?? null;
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
  // Selects the tile nearest to `c` inside the area, and says which one that is.
  const select = (c: Cell): Cell => {
    const next = within(view.area, c);
    setRaw(next);
    setMessage(null);
    return next;
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
  return { selected, select, guess, message, sending };
}

// The row under the grid: ring, the selected tile in words, the fields and arrows, Guess.
function GuessRow(p: {
  readonly props: StInputProps;
  readonly selected: Cell;
  readonly select: (c: Cell) => void;
  readonly steer: boolean;
  readonly sending: boolean;
  readonly guess: () => void;
}): ReactElement {
  return (
    <div className="st-row">
      {p.props.ring}
      <p className="st-selected" aria-live="polite" data-testid="selected">
        Selected: {cellWords(p.selected)}
      </p>
      {p.steer ? <Steer selected={p.selected} select={p.select} /> : null}
      <button
        type="button"
        className="smg-btn smg-btn--primary st-go"
        disabled={!p.props.canAct || p.sending}
        onClick={p.guess}
        data-testid="guess-button"
      >
        {buttonText('Guess', p.props.waitS)}
      </button>
    </div>
  );
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
    if (step !== undefined) t.select({ x: t.selected.x + step[0], y: t.selected.y + step[1] });
    else if (e.key === 'Enter' && props.canAct && !t.sending) guess();
    else return;
    e.preventDefault();
  };
  const onTile = (c: Cell): void => {
    const next = t.select(c);
    if (viaLoupe) loupe.show(next);
  };
  const pick = (c: Cell): void => {
    loupe.follow(t.select(c));
  };
  return { t, size, compact, loupe, guess, onKeyDown, onTile, pick };
}

export function TargetInput(props: StInputProps): ReactElement {
  const view = props.view as PlayerView;
  const { t, size, compact, loupe, guess, onKeyDown, onTile, pick } = useAim(view, props);
  const grid = {
    map: view.map,
    area: view.area,
    quarter: view.hint,
    fallen: view.fallen,
    tiles: tilesOf(shotsOf(view.guesses, view.log), props),
  };
  const last = view.guesses.at(-1)?.feedback ?? null;
  return (
    <div className="st-input" data-testid="st-input">
      <div className="st-board">
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
      </div>
      <HeatLegend />
      <GuessRow
        props={props}
        selected={t.selected}
        select={t.select}
        steer={!compact}
        sending={t.sending}
        guess={guess}
      />
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
