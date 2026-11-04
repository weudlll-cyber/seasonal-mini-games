/**
 * @file   games/safecracker/web/CodeInput.tsx
 * @module games/safecracker/web
 * @brief  The input row: the cooldown ring, one box per digit, and the large Try code button.
 *
 * Responsibility: typing a digit fills its box and moves on; Backspace in an empty box goes
 *                 back and clears that one; the arrow keys move between boxes; pasting a full
 *                 code fills every box; Enter sends when every box is filled (the form's own
 *                 submit, blocked while the button is disabled; during the cooldown it reads
 *                 "Wait 6 s", `buttonText`, T125). A digit outside the digits in
 *                 use, or a fallen one, is refused in its box with the sentence of 02b §4 and
 *                 nothing is sent (T113); the server checks again. Try code is disabled during
 *                 the cooldown, while a guess is on its way and until the code is complete. The
 *                 boxes are emptied only if they still hold the code sent, so nothing typed is
 *                 lost (T76). Typing sends nothing (05 §3.1). Spring Herald's digit stands in
 *                 its box from the round's opening, locked and in the season colour: no key,
 *                 paste or reset changes it, focus steps over it, and its name tells a screen
 *                 reader "hint: 3 in place 2" (O59); the server still checks the whole code.
 * Depends on:     react, @smg/game-sdk (props, buttonText), @smg-game/safecracker (types), ./text
 * Used by:        ./index
 * Spec:           docs/spec/02b-game-safecracker.md §4, §10
 */
import type { Hint, PlayerView } from '@smg-game/safecracker';
import { buttonText, type PlayerPanelProps } from '@smg/game-sdk';
import {
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
} from 'react';

import { invalidCode, safecrackerText } from './text.js';

export type CodeInputProps = PlayerPanelProps & { readonly ring?: ReactNode };

// Why a typed character may not go into a box, or null when it may.
function refusal(ch: string, v: PlayerView): string | null {
  if (!/^[0-9]$/.test(ch) || Number(ch) >= v.digits) return invalidCode(v.length, v.digits);
  return v.fallen.includes(Number(ch)) ? safecrackerText.code('DIGIT_REMOVED') : null;
}

// Why a pasted text may not fill the boxes, or null when it may: a full code that keeps the
// hint's digit in its place.
function pasteRefusal(code: string, v: PlayerView): string | null {
  if (code.length !== v.length) return invalidCode(v.length, v.digits);
  const own =
    Array.from(code)
      .map((ch) => refusal(ch, v))
      .find((m) => m !== null) ?? null;
  if (own !== null || v.hint === null) return own;
  return code[v.hint.position] === String(v.hint.digit) ? null : hintKept(v.hint);
}

// The locked box's words for a screen reader and the refused paste (O59).
const hintLabel = (h: Hint): string =>
  `hint: ${String(h.digit)} in place ${String(h.position + 1)}`;
const hintKept = (h: Hint): string =>
  `Place ${String(h.position + 1)} keeps the hint, ${String(h.digit)}.`;

// The words for a refused guess: the game's, or null for the platform's own codes.
const replyWords = (code: string, v: PlayerView): string | null =>
  code === 'CODE_INVALID' ? invalidCode(v.length, v.digits) : safecrackerText.code(code);

// The boxes' digits, the refusal line and the focus moves.
function useBoxes(v: PlayerView) {
  const [typed, setTyped] = useState<readonly string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const locked = v.hint?.position ?? -1;
  // As many boxes as the round's code has digits; the hint's box always holds its digit.
  const cells = Array.from({ length: v.length }, (_, i) =>
    i === locked ? String(v.hint?.digit ?? '') : (typed[i] ?? ''),
  );
  // Focus moves step over the locked box, in the direction of travel (`from` the box left).
  const focus = (i: number, from = i - 1): void => {
    const step = i < from ? -1 : 1;
    const to = i === locked ? i + step : i;
    const at = to < 0 || to >= v.length ? i - step : to;
    refs.current[Math.max(0, Math.min(v.length - 1, at))]?.focus();
  };
  const put = (i: number, ch: string): void => {
    if (i === locked) return;
    setTyped(cells.map((c, k) => (k === i ? ch : c)));
  };
  const type = (i: number, text: string): void => {
    const ch = text.slice(-1);
    const no = ch === '' ? null : refusal(ch, v);
    setMessage(no);
    if (no !== null) return;
    put(i, ch);
    if (ch !== '') focus(i + 1);
  };
  const paste = (text: string): void => {
    const code = text.replace(/\s/g, '');
    const no = pasteRefusal(code, v);
    setMessage(no);
    if (no !== null) return;
    setTyped(Array.from(code));
    focus(v.length - 1);
  };
  return { cells, locked, setTyped, message, setMessage, refs, focus, put, type, paste };
}

type Boxes = ReturnType<typeof useBoxes>;

// Sending the full code: one at a time, the boxes kept when typed on meanwhile (T76).
function useSend(props: CodeInputProps, boxes: Boxes) {
  const v = props.view as PlayerView;
  const [sending, setSending] = useState(false);
  const code = boxes.cells.join('');
  const complete = code.length === v.length;
  const submit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (!complete || sending) return;
    setSending(true);
    void props
      .act({ value: code })
      .then((reply) => {
        boxes.setMessage(reply.ok ? null : replyWords(reply.code ?? '', v));
        if (!reply.ok) return;
        boxes.setTyped((now) => (now.join('') === code ? [] : now));
        boxes.focus(0, -1);
      })
      .finally(() => {
        setSending(false);
      });
  };
  return { sending, complete, submit };
}

// One digit's box: Backspace in an empty (or the locked) box goes back and clears the box
// before, past the locked one; arrows move.
function DigitBox(p: {
  readonly i: number;
  readonly boxes: Boxes;
  readonly hint: Hint | null;
}): ReactElement {
  const { i, boxes, hint } = p;
  const n = boxes.cells.length;
  const isHint = i === boxes.locked;
  const keys = (e: KeyboardEvent<HTMLInputElement>): void => {
    const back = e.key === 'Backspace' && (boxes.cells[i] === '' || isHint);
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && !back) return;
    e.preventDefault();
    const before = i - 1 === boxes.locked ? i - 2 : i - 1;
    if (back && before >= 0) boxes.put(before, '');
    boxes.focus(e.key === 'ArrowRight' ? i + 1 : i - 1, i);
  };
  return (
    <input
      ref={(el) => {
        boxes.refs.current[i] = el;
      }}
      className={isHint ? 'sc-box sc-box--hint' : 'sc-box'}
      inputMode="numeric"
      autoComplete="off"
      enterKeyHint="send"
      readOnly={isHint}
      aria-label={`Digit ${String(i + 1)} of ${String(n)}${hint !== null && isHint ? `, ${hintLabel(hint)}` : ''}`}
      value={boxes.cells[i] ?? ''}
      onFocus={(e) => {
        e.target.select();
      }}
      onChange={(e) => {
        if (!isHint) boxes.type(i, e.target.value);
      }}
      onKeyDown={keys}
      onPaste={(e) => {
        e.preventDefault();
        boxes.paste(e.clipboardData.getData('text'));
      }}
      data-testid={`code-box-${String(i)}`}
    />
  );
}

export function CodeInput(props: CodeInputProps): ReactElement {
  const v = props.view as PlayerView;
  const boxes = useBoxes(v);
  const send = useSend(props, boxes);
  const n = boxes.cells.length;
  return (
    <div className="sc-input">
      <form className="sc-form" onSubmit={send.submit}>
        {props.ring}
        <div className="sc-boxes" role="group" aria-label={`Your code, ${String(n)} digits`}>
          {boxes.cells.map((_, i) => (
            <DigitBox key={i} i={i} boxes={boxes} hint={v.hint} />
          ))}
        </div>
        <button
          className="smg-btn smg-btn--primary sc-go"
          type="submit"
          disabled={!props.canAct || send.sending || !send.complete}
          data-testid="guess-button"
        >
          {buttonText('Try code', props.waitS)}
        </button>
      </form>
      {boxes.message === null ? null : (
        <p className="sc-message" role="status">
          {boxes.message}
        </p>
      )}
    </div>
  );
}
