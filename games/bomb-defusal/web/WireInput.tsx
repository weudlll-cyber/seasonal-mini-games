/**
 * @file   games/bomb-defusal/web/WireInput.tsx
 * @module games/bomb-defusal/web
 * @brief  The input row: sequence slots, wire buttons, and the ring with Undo, Clear and Cut.
 *
 * Responsibility: one help line above the picker, always in view ("Tap colours in cutting
 *                 order: they fill 1 → 6. …"); `cuts` numbered slots, a filled one with
 *                 swatch and name, a button that
 *                 empties just that slot; Spring Herald's colour locked in slot 1, outlined in
 *                 the season colour and named "hint: red in place 1" (O60); one button per wire in palette order (swatch and name, at least 44 px),
 *                 disabled with its slot number once in the slots, with a crossed swatch, a
 *                 struck name and the label "red, harmless" once Leaf Fall marked it; a
 *                 slot holding a wire marked harmless afterwards stays, marked, with "take it
 *                 out"; the platform's cooldown ring at the start of the row with Undo, Clear
 *                 and Cut, Cut enabled only with every slot filled, the cooldown over and no cut
 *                 on its way, reading "Wait 6 s" during the cooldown (T125); the game's
 *                 refusals in words; the explosion when a wrong first cut's answer arrives
 *                 (02c §5.2, §11). Building is local (./useSequence).
 * Depends on:     react, @smg/game-sdk (props, buttonText), @smg-game/bomb-defusal (types),
 *                 ./Explosion, ./text, ./useSequence, ./WireChip
 * Used by:        ./index
 * Spec:           docs/spec/02c-game-bomb-defusal.md §5.2, §11
 */
import type { PlayerView, Wire } from '@smg-game/bomb-defusal';
import { buttonText, type PlayerPanelProps } from '@smg/game-sdk';
import type { ReactElement, ReactNode } from 'react';

import { Explosion, useExplosion } from './Explosion.js';
import { pickerHelp, takeOutText } from './text.js';
import { useSequence, type Slot } from './useSequence.js';
import { Swatch, WireChip } from './WireChip.js';

// One slot's content: its number and wire; a filled slot the player may empty is a button.
function SlotBody(p: {
  readonly i: number;
  readonly wire: Slot;
  readonly hint: boolean;
  readonly view: PlayerView;
  readonly onEmpty: (i: number) => void;
}): ReactElement {
  const place = String(p.i + 1);
  const body = (
    <>
      <span className="bd-slot-number">{place}</span>
      {p.wire === null ? null : (
        <WireChip wire={p.wire} harmless={p.view.harmless.includes(p.wire)} />
      )}
    </>
  );
  if (p.hint) {
    return (
      <span className="bd-slot-body" aria-label={`hint: ${p.wire ?? ''} in place ${place}`}>
        {body}
      </span>
    );
  }
  if (p.wire === null) return <span className="bd-slot-body">{body}</span>;
  return (
    <button
      type="button"
      className="bd-slot-body bd-slot-take"
      aria-label={`${p.wire} in place ${place}, take it out`}
      onClick={() => {
        p.onEmpty(p.i);
      }}
      data-testid={`slot-${String(p.i)}`}
    >
      {body}
    </button>
  );
}

function Slots(p: {
  readonly slots: readonly Slot[];
  readonly locked: boolean;
  readonly view: PlayerView;
  readonly onEmpty: (i: number) => void;
}): ReactElement {
  return (
    <ol className="bd-slots" aria-label="Your cutting order" data-testid="slots">
      {p.slots.map((wire, i) => {
        const hint = p.locked && i === 0;
        return (
          <li key={i} className="bd-slot" data-hint={hint} data-filled={wire !== null}>
            <SlotBody i={i} wire={wire} hint={hint} view={p.view} onEmpty={p.onEmpty} />
          </li>
        );
      })}
    </ol>
  );
}

function WireButton(p: {
  readonly wire: Wire;
  readonly slot: number;
  readonly harmless: boolean;
  readonly full: boolean;
  readonly onAdd: (wire: Wire) => void;
}): ReactElement {
  const used = p.slot >= 0;
  return (
    <button
      type="button"
      className="smg-btn bd-wire"
      data-harmless={p.harmless}
      aria-label={p.harmless ? `${p.wire}, harmless` : undefined}
      disabled={used || p.harmless || p.full}
      onClick={() => {
        p.onAdd(p.wire);
      }}
      data-testid={`wire-${p.wire}`}
    >
      <Swatch wire={p.wire} crossed={p.harmless} />
      <span className="bd-wire-name">{p.wire}</span>
      {used ? <span className="bd-wire-note">{p.slot + 1}</span> : null}
    </button>
  );
}

// One button per wire in palette order, each showing its slot once it is in one.
function WireButtons(p: {
  readonly view: PlayerView;
  readonly seq: ReturnType<typeof useSequence>;
}): ReactElement {
  const { view, seq } = p;
  return (
    <div className="bd-wires" data-count={view.wires.length}>
      {view.wires.map((w) => (
        <WireButton
          key={w}
          wire={w}
          slot={seq.slots.indexOf(w)}
          harmless={view.harmless.includes(w)}
          full={seq.full}
          onAdd={seq.add}
        />
      ))}
    </div>
  );
}

export function WireInput(props: PlayerPanelProps & { readonly ring?: ReactNode }): ReactElement {
  const view = props.view as PlayerView;
  const s = useSequence(view, props.act, props.canAct);
  const boom = useExplosion(view.guesses);
  const stale = s.slots.find((w): w is Wire => w !== null && view.harmless.includes(w));
  return (
    <div className="bd-input" onKeyDown={s.onKey} data-testid="bd-input">
      <p className="bd-help" data-testid="bd-help">
        {pickerHelp(view.cuts, s.locked)}
      </p>
      <Slots slots={s.slots} locked={s.locked} view={view} onEmpty={s.empty} />
      <WireButtons view={view} seq={s} />
      <div className="bd-actions">
        {props.ring}
        <button
          type="button"
          className="smg-btn bd-action"
          onClick={s.undo}
          disabled={!s.removable}
        >
          Undo
        </button>
        <button
          type="button"
          className="smg-btn bd-action"
          onClick={s.clear}
          disabled={!s.removable}
        >
          Clear
        </button>
        <button
          type="button"
          className="smg-btn smg-btn--primary bd-cut"
          onClick={s.cut}
          disabled={!s.full || !props.canAct || s.sending}
          data-testid="cut-button"
        >
          {buttonText('Cut', props.waitS)}
        </button>
      </div>
      {stale === undefined ? null : <p className="bd-message">{takeOutText(stale)}</p>}
      {s.message === null ? null : (
        <p className="bd-message" role="status">
          {s.message}
        </p>
      )}
      {boom ? <Explosion /> : null}
    </div>
  );
}
