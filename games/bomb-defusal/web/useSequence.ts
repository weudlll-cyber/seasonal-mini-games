/**
 * @file   games/bomb-defusal/web/useSequence.ts
 * @module games/bomb-defusal/web
 * @brief  The sequence a player builds by tapping wires, and sending it with Cut.
 *
 * Responsibility: the slots hold a wire or nothing; tapping a wire fills the first empty slot
 *                 (never twice, never a harmless one); tapping a filled slot empties just that
 *                 slot; Undo empties the last filled slot, Clear every slot. Spring Herald's
 *                 colour stands in slot 1 from the round's opening, locked: no tap, Undo or
 *                 Clear empties it (O60). Cut sends the whole sequence as one guess intent
 *                 (nothing is sent per tap, 05 §3.1); the server checks it whole again. A
 *                 sequence that is not full, or holds a wire marked harmless after it was put
 *                 in, is refused at once with the server's words and not sent (02c §4, §8.3).
 *                 Cut waits while a cut is on its way; the slots are emptied only if they still
 *                 hold the sequence sent, so the sequence survives the round opening and
 *                 anything changed meanwhile stays (T76). Keys: 1–8 the wires in order,
 *                 Backspace Undo, Escape Clear, Enter Cut (02c §11).
 * Depends on:     react, @smg/game-sdk (props), @smg-game/bomb-defusal (types), ./text
 * Used by:        ./WireInput
 * Spec:           docs/spec/02c-game-bomb-defusal.md §4, §8.1, §11
 */
import { sequenceText, type PlayerView, type Wire } from '@smg-game/bomb-defusal';
import type { PlayerPanelProps } from '@smg/game-sdk';
import { useState, type KeyboardEvent } from 'react';

import { bdText, chooseText } from './text.js';

// A slot: its wire, or null while empty.
export type Slot = Wire | null;

interface Keys {
  readonly add: (wire: Wire | undefined) => void;
  readonly undo: () => void;
  readonly clear: () => void;
  readonly cut: () => void;
}

// 1–8 the wires in palette order, Backspace Undo, Escape Clear, Enter Cut (02c §11).
function keyPress(e: KeyboardEvent, wires: readonly Wire[], k: Keys): void {
  const named: Readonly<Record<string, () => void>> = {
    Backspace: k.undo,
    Escape: k.clear,
    Enter: k.cut,
  };
  const digit = /^[1-8]$/.test(e.key) ? Number(e.key) : null;
  const run =
    digit === null
      ? named[e.key]
      : () => {
          k.add(wires[digit - 1]);
        };
  if (run === undefined) return;
  // Enter on a focused button would also press it: the key means Cut here.
  e.preventDefault();
  run();
}

// The slots as shown: what the player put in, with the hint's colour locked in slot 1 (a wire
// put in before the hint arrived gives way to it, so no wire stands twice).
function shown(typed: readonly Slot[], view: PlayerView): readonly Slot[] {
  return Array.from({ length: view.cuts }, (_, i) => {
    if (view.hint !== null && i === 0) return view.hint;
    const wire = typed[i] ?? null;
    return wire === view.hint ? null : wire;
  });
}

const wiresOf = (slots: readonly Slot[]): Wire[] => slots.filter((w): w is Wire => w !== null);

// The slot list with slot `i` set to `wire`, or the same list where `i` is locked or absent.
const withSlot = (slots: readonly Slot[], locked: boolean, i: number, wire: Slot) =>
  i < 0 || (locked && i === 0) ? slots : slots.map((w, k) => (k === i ? wire : w));

// The slots and the edits on them: fill the first empty one, empty one, Undo, Clear.
function useSlots(view: PlayerView) {
  const [typed, setTyped] = useState<readonly Slot[]>([]);
  const locked = view.hint !== null;
  const slots = shown(typed, view);
  const filled = wiresOf(slots);
  const full = filled.length >= view.cuts;
  const put = (i: number, wire: Slot): void => {
    setTyped(withSlot(slots, locked, i, wire));
  };
  const add = (wire: Wire | undefined): boolean => {
    if (wire === undefined || full || slots.includes(wire) || view.harmless.includes(wire)) {
      return false;
    }
    put(slots.indexOf(null), wire);
    return true;
  };
  // Empties one slot the player tapped (the locked hint stays).
  const empty = (i: number): void => {
    put(i, null);
  };
  const undo = (): void => {
    put(
      slots.findLastIndex((w, i) => w !== null && !(locked && i === 0)),
      null,
    );
  };
  const clear = (): void => {
    setTyped([]);
  };
  // Something the player can take out: Undo and Clear are disabled without it.
  const removable = filled.length > (locked ? 1 : 0);
  return { slots, filled, locked, full, removable, setTyped, add, empty, undo, clear };
}

export function useSequence(view: PlayerView, act: PlayerPanelProps['act'], canAct: boolean) {
  const s = useSlots(view);
  const [message, setMessage] = useState<string | null>(null);
  // A cut on its way: Cut waits for its answer, so the next one is never sent early.
  const [sending, setSending] = useState(false);
  const add = (wire: Wire | undefined): void => {
    if (s.add(wire)) setMessage(null);
  };

  const cut = (): void => {
    if (!s.full) {
      setMessage(chooseText(view.cuts));
      return;
    }
    if (s.filled.some((w) => view.harmless.includes(w))) {
      setMessage(bdText.code('WIRE_HARMLESS'));
      return;
    }
    if (!canAct || sending) return;
    const sent = sequenceText(s.filled);
    setSending(true);
    void act({ value: s.filled })
      .then((reply) => {
        setMessage(reply.ok ? null : bdText.code(reply.code ?? ''));
        // Empty the slots only if they still hold the sequence sent (T76).
        if (!reply.ok) return;
        s.setTyped((now) => (sequenceText(wiresOf(shown(now, view))) === sent ? [] : now));
      })
      .finally(() => {
        setSending(false);
      });
  };

  const onKey = (e: KeyboardEvent): void => {
    keyPress(e, view.wires, { add, undo: s.undo, clear: s.clear, cut });
  };

  const { slots, locked, full, removable, empty, undo, clear } = s;
  return { slots, locked, full, removable, message, sending, add, empty, undo, clear, cut, onKey };
}
