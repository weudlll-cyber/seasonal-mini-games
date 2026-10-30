/**
 * @file   games/guess-the-number/web/PlayerPanel.tsx
 * @module games/guess-the-number/web
 * @brief  The player's two parts: the main area (range, own guesses) and the input row.
 *
 * Responsibility: `PlayerPanel` is the main area: the range block (./RangeBar) with Spring
 *                 Herald's hint under it and "Your guesses" as chips "250 ↓" with the answer
 *                 as an arrow, or "answer arriving in 2 s" while Frost holds one (02 §12).
 *                 `GuessInput` is the input row, placed by the platform (pinned at the
 *                 bottom on a phone): the platform's cooldown ring, a number field that takes
 *                 a minus sign (with the shared ± button of @smg/ui where negative numbers are
 *                 possible, since phone keypads often lack one, T57) and a large Guess button;
 *                 Enter sends. The field takes whole numbers from
 *                 −1 000 000 000 to 1 000 000 000 (T53). The game's own refusals are shown in
 *                 plain words; the platform's are shown by the platform.
 * Depends on:     react, @smg/game-sdk (props), @smg/ui (sign toggle),
 *                 @smg-game/guess-the-number (types, limit), ./RangeBar, ./text
 * Used by:        ./index
 * Spec:           docs/spec/02-game-guess-the-number.md §6, §12; docs/spec/03-seasonal-specials.md §2.1, §2.4
 */
import { GUESS_LIMIT, type PlayerView } from '@smg-game/guess-the-number';
import type { PlayerPanelProps } from '@smg/game-sdk';
import { flipSign, SignToggle } from '@smg/ui';
import { useState, type ReactElement, type ReactNode, type SyntheticEvent } from 'react';

import { RangeBar } from './RangeBar.js';
import { answerText, ARROWS, gtnText, hintText } from './text.js';

// The platform hands its cooldown ring in, to sit at the start of the input row.
export type GtnPlayerProps = PlayerPanelProps & { readonly ring?: ReactNode };

function Arriving({ at, now }: { readonly at: number; readonly now: () => number }): ReactElement {
  const seconds = Math.max(0, Math.ceil((at - now()) / 1_000));
  return <span className="gtn-frost">answer arriving in {seconds} s</span>;
}

// A whole number the field takes, or null.
function parsed(text: string): number | null {
  const t = text.trim().replace('−', '-');
  if (!/^-?\d+$/.test(t)) return null;
  const n = Number(t);
  return Math.abs(n) <= GUESS_LIMIT ? n : null;
}

// The field's text, the game's refusal line, sending, and flipping the sign.
function useGuess(act: PlayerPanelProps['act']) {
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const submit = (e: SyntheticEvent): void => {
    e.preventDefault();
    const n = parsed(value);
    if (n === null) {
      setMessage(gtnText.code('INVALID_ACTION'));
      return;
    }
    void act({ value: n }).then((reply) => {
      setMessage(reply.ok ? null : gtnText.code(reply.code ?? ''));
      if (reply.ok) setValue('');
    });
  };
  const flip = (): void => {
    setValue(flipSign);
  };
  return { value, setValue, message, submit, flip };
}

export function GuessInput(props: GtnPlayerProps): ReactElement {
  const view = props.view as PlayerView;
  const { value, setValue, message, submit, flip } = useGuess(props.act);
  const negative = view.range === null || view.range.low < 0;
  return (
    <div className="gtn-input">
      <form className="gtn-guess" onSubmit={submit}>
        {props.ring}
        <label className="smg-visually-hidden" htmlFor="gtn-value">
          Your guess
        </label>
        <input
          id="gtn-value"
          className="smg-input"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="send"
          // The range block above names the range; a phone has no room for it in the field.
          placeholder="Your guess"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          data-testid="guess-input"
        />
        {negative ? <SignToggle label="Change the sign" onFlip={flip} /> : null}
        <button
          className="smg-btn smg-btn--primary gtn-go"
          type="submit"
          disabled={!props.canAct}
          data-testid="guess-button"
        >
          Guess
        </button>
      </form>
      {message === null ? null : (
        <p className="gtn-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

function OwnGuesses({
  view,
  props,
}: {
  readonly view: PlayerView;
  readonly props: PlayerPanelProps;
}): ReactElement {
  return (
    <section className="gtn-own" aria-labelledby="gtn-own-title">
      <h2 id="gtn-own-title" className="gtn-own-title">
        Your guesses
      </h2>
      {view.guesses.length === 0 ? (
        <p className="gtn-own-none">None yet.</p>
      ) : (
        <ol className="gtn-chips" data-testid="own-guesses">
          {[...view.guesses].reverse().map((g) => (
            <li key={g.receiveSeq} className="gtn-chip" data-feedback={g.feedback ?? 'pending'}>
              {g.feedback === null ? (
                <>
                  {g.value}{' '}
                  <Arriving at={g.receivedAt + (props.frostDelayMs ?? 0)} now={props.now} />
                </>
              ) : (
                <>
                  {g.value} <span aria-hidden="true">{ARROWS[g.feedback]}</span>
                  <span className="smg-visually-hidden">{answerText(g.value, g.feedback)}</span>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function PlayerPanel(props: PlayerPanelProps): ReactElement {
  const view = props.view as PlayerView;
  return (
    <div className="gtn-player" data-testid="gtn-player">
      <RangeBar range={view.range} removed={view.removed} />
      {view.hint === null ? null : (
        <p className="gtn-hint" data-testid="hint">
          <strong>Spring Herald:</strong> {hintText(view.hint)}
        </p>
      )}
      <OwnGuesses view={view} props={props} />
    </div>
  );
}
