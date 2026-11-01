/**
 * @file   games/bomb-defusal/web/WireInput.tsx
 * @module games/bomb-defusal/web
 * @brief  The input row: sequence slots, wire buttons, and the ring with Undo, Clear and Cut.
 *
 * Responsibility: `cuts` numbered slots, a filled one with swatch and name, slot 1 outlined
 *                 with "hint: red" when Spring Herald named the first cut; one button per wire
 *                 in palette order (swatch and name, at least 44 px), disabled with its slot
 *                 number once in the slots, struck with "harmless" once Leaf Fall marked it; a
 *                 slot holding a wire marked harmless afterwards stays, marked, with "take it
 *                 out"; the platform's cooldown ring at the start of the row with Undo, Clear
 *                 and Cut, Cut enabled only with every slot filled, the cooldown over and no cut
 *                 on its way; the game's refusals in words; the explosion when a wrong first
 *                 cut's answer arrives (02c §5.2, §11). Building is local (./useSequence).
 * Depends on:     react, @smg/game-sdk (props), @smg-game/bomb-defusal (types), ./Explosion,
 *                 ./text, ./useSequence, ./WireChip
 * Used by:        ./index
 * Spec:           docs/spec/02c-game-bomb-defusal.md §5.2, §11
 */
import type { PlayerView, Wire } from '@smg-game/bomb-defusal';
import type { PlayerPanelProps } from '@smg/game-sdk';
import type { ReactElement, ReactNode } from 'react';

import { Explosion, useExplosion } from './Explosion.js';
import { takeOutText } from './text.js';
import { useSequence } from './useSequence.js';
import { Swatch, WireChip } from './WireChip.js';

function Slots(p: { readonly slots: readonly Wire[]; readonly view: PlayerView }): ReactElement {
  const { slots, view } = p;
  return (
    <ol className="bd-slots" aria-label="Your cutting order" data-testid="slots">
      {Array.from({ length: view.cuts }, (_, i) => {
        const wire = slots[i];
        const hint = i === 0 && view.hint !== null;
        return (
          <li key={i} className="bd-slot" data-hint={hint} data-filled={wire !== undefined}>
            <span className="bd-slot-number">{i + 1}</span>
            {wire === undefined ? (
              hint && <span className="bd-slot-hint">hint: {view.hint}</span>
            ) : (
              <WireChip wire={wire} harmless={view.harmless.includes(wire)} />
            )}
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
      disabled={used || p.harmless || p.full}
      onClick={() => {
        p.onAdd(p.wire);
      }}
      data-testid={`wire-${p.wire}`}
    >
      <Swatch wire={p.wire} />
      <span className="bd-wire-name">{p.wire}</span>
      {used ? <span className="bd-wire-note">{p.slot + 1}</span> : null}
      {p.harmless ? <span className="bd-wire-note">harmless</span> : null}
    </button>
  );
}

export function WireInput(props: PlayerPanelProps & { readonly ring?: ReactNode }): ReactElement {
  const view = props.view as PlayerView;
  const s = useSequence(view, props.act, props.canAct);
  const boom = useExplosion(view.guesses);
  const stale = s.slots.find((w) => view.harmless.includes(w));
  return (
    <div className="bd-input" onKeyDown={s.onKey} data-testid="bd-input">
      <Slots slots={s.slots} view={view} />
      <div className="bd-wires" data-count={view.wires.length}>
        {view.wires.map((w) => (
          <WireButton
            key={w}
            wire={w}
            slot={s.slots.indexOf(w)}
            harmless={view.harmless.includes(w)}
            full={s.full}
            onAdd={s.add}
          />
        ))}
      </div>
      <div className="bd-actions">
        {props.ring}
        <button
          type="button"
          className="smg-btn bd-action"
          onClick={s.undo}
          disabled={s.slots.length === 0}
        >
          Undo
        </button>
        <button
          type="button"
          className="smg-btn bd-action"
          onClick={s.clear}
          disabled={s.slots.length === 0}
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
          Cut
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
