/**
 * @file   games/seasonal-target/web/Steer.tsx
 * @module games/seasonal-target/web
 * @brief  The secondary way to aim: the Column and Row fields and the four arrow buttons.
 *
 * Responsibility: two compact number fields that show the selection and set it, and the
 *                 N/W/E/S buttons (44 × 44 px, "Move north" … for screen readers) that move it
 *                 by one tile; the caller clamps to the target area. Under the grid on a
 *                 desktop, inside the loupe on a phone (02d §11).
 * Depends on:     react, @smg-game/seasonal-target (types)
 * Used by:        ./TargetInput, ./Loupe
 * Spec:           docs/spec/02d-game-seasonal-target.md §11
 */
import type { Cell } from '@smg-game/seasonal-target';
import type { ReactElement } from 'react';

interface SteerProps {
  readonly selected: Cell;
  readonly select: (c: Cell) => void;
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

export function Steer({ selected, select }: SteerProps): ReactElement {
  return (
    <div className="st-steer">
      <div className="st-fields">
        <Field
          label="Column"
          value={selected.x}
          set={(x) => {
            select({ ...selected, x });
          }}
        />
        <Field
          label="Row"
          value={selected.y}
          set={(y) => {
            select({ ...selected, y });
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
              select({ x: selected.x + dx, y: selected.y + dy });
            }}
          >
            {glyph}
          </button>
        ))}
      </div>
    </div>
  );
}
