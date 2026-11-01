/**
 * @file   games/bomb-defusal/web/useSequence.ts
 * @module games/bomb-defusal/web
 * @brief  The sequence a player builds by tapping wires, and sending it with Cut.
 *
 * Responsibility: tapping a wire appends it to the next free slot (never twice, never a
 *                 harmless one); Undo, Clear; Cut sends the whole sequence as one guess intent
 *                 (nothing is sent per tap, 05 §3.1). A sequence that is not full, or holds a
 *                 wire marked harmless after it was put in, is refused at once with the server's
 *                 words and not sent (02c §4, §8.3). Cut waits while a cut is on its way; the
 *                 slots are emptied only if they still hold the sequence sent, so the sequence
 *                 survives the round opening and anything changed meanwhile stays (T76). Keys:
 *                 1–8 the wires in order, Backspace Undo, Escape Clear, Enter Cut (02c §11).
 * Depends on:     react, @smg/game-sdk (props), @smg-game/bomb-defusal (types), ./text
 * Used by:        ./WireInput
 * Spec:           docs/spec/02c-game-bomb-defusal.md §4, §11
 */
import { sequenceText, type PlayerView, type Wire } from '@smg-game/bomb-defusal';
import type { PlayerPanelProps } from '@smg/game-sdk';
import { useState, type KeyboardEvent } from 'react';

import { bdText, chooseText } from './text.js';

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

export function useSequence(view: PlayerView, act: PlayerPanelProps['act'], canAct: boolean) {
  const [slots, setSlots] = useState<readonly Wire[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  // A cut on its way: Cut waits for its answer, so the next one is never sent early.
  const [sending, setSending] = useState(false);
  const full = slots.length >= view.cuts;

  const add = (wire: Wire | undefined): void => {
    if (wire === undefined || full || slots.includes(wire) || view.harmless.includes(wire)) return;
    setSlots([...slots, wire]);
    setMessage(null);
  };
  const undo = (): void => {
    setSlots(slots.slice(0, -1));
  };
  const clear = (): void => {
    setSlots([]);
  };

  const cut = (): void => {
    if (!full) {
      setMessage(chooseText(view.cuts));
      return;
    }
    if (slots.some((w) => view.harmless.includes(w))) {
      setMessage(bdText.code('WIRE_HARMLESS'));
      return;
    }
    if (!canAct || sending) return;
    const sent = sequenceText(slots);
    setSending(true);
    void act({ value: slots })
      .then((reply) => {
        setMessage(reply.ok ? null : bdText.code(reply.code ?? ''));
        // Empty the slots only if they still hold the sequence sent (T76).
        if (reply.ok) setSlots((now) => (sequenceText(now) === sent ? [] : now));
      })
      .finally(() => {
        setSending(false);
      });
  };

  const onKey = (e: KeyboardEvent): void => {
    keyPress(e, view.wires, { add, undo, clear, cut });
  };

  return { slots, full, message, sending, add, undo, clear, cut, onKey };
}
