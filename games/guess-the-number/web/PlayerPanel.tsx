/**
 * @file   games/guess-the-number/web/PlayerPanel.tsx
 * @module games/guess-the-number/web
 * @brief  The player's own screen part: hint, range bar, the guess field and own guesses.
 *
 * Responsibility: Spring Herald's hint as a card; the range bar with the band the server
 *                 sent; a number field with Guess (Enter works), disabled while the platform
 *                 says the player cannot act; the player's guesses newest first with their
 *                 answers, or "answer arriving in 2 s" while Frost holds one (02 §12). The
 *                 game's own refusals are shown in plain words; the platform's are shown by
 *                 the platform.
 * Depends on:     react, @smg/game-sdk (props), @smg-game/guess-the-number (types), ./RangeBar, ./text
 * Used by:        ./index
 * Spec:           docs/spec/02-game-guess-the-number.md §6, §12; docs/spec/03-seasonal-specials.md §2.1, §2.4
 */
import type { PlayerView } from '@smg-game/guess-the-number';
import type { PlayerPanelProps } from '@smg/game-sdk';
import { useState, type ReactElement, type SyntheticEvent } from 'react';

import { RangeBar } from './RangeBar.js';
import { answerText, gtnText, hintText } from './text.js';

function Arriving({ at, now }: { readonly at: number; readonly now: () => number }): ReactElement {
  const seconds = Math.max(0, Math.ceil((at - now()) / 1_000));
  return <span className="gtn-frost">Answer arriving in {seconds} s</span>;
}

function GuessForm({
  view,
  props,
}: {
  readonly view: PlayerView;
  readonly props: PlayerPanelProps;
}): ReactElement {
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const submit = (e: SyntheticEvent): void => {
    e.preventDefault();
    const n = Number(value);
    if (value.trim() === '' || !Number.isInteger(n)) {
      setMessage(gtnText.code('INVALID_ACTION'));
      return;
    }
    void props.act({ value: n }).then((reply) => {
      setMessage(reply.ok ? null : gtnText.code(reply.code ?? ''));
      if (reply.ok) setValue('');
    });
  };
  return (
    <>
      <form className="gtn-guess smg-row" onSubmit={submit}>
        <label className="smg-visually-hidden" htmlFor="gtn-value">
          Your guess
        </label>
        <input
          id="gtn-value"
          className="smg-input"
          inputMode="numeric"
          autoComplete="off"
          placeholder={`${String(view.range.low)}–${String(view.range.high)}`}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          data-testid="guess-input"
        />
        <button
          className="smg-btn smg-btn--primary"
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
    </>
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
    <ol className="gtn-guesses" aria-label="Your guesses" data-testid="own-guesses">
      {[...view.guesses].reverse().map((g) => (
        <li key={g.receiveSeq}>
          {g.feedback === null ? (
            <>
              {g.value}: <Arriving at={g.receivedAt + (props.frostDelayMs ?? 0)} now={props.now} />
            </>
          ) : (
            answerText(g.value, g.feedback)
          )}
        </li>
      ))}
    </ol>
  );
}

export function PlayerPanel(props: PlayerPanelProps): ReactElement {
  const view = props.view as PlayerView;
  return (
    <div className="gtn-player" data-testid="gtn-player">
      {view.hint === null ? null : (
        <p className="gtn-hint smg-panel smg-panel--inset" data-testid="hint">
          <strong>Spring Herald:</strong> {hintText(view.hint)}
        </p>
      )}
      <RangeBar range={view.range} band={view.band} removed={view.removed} label="Your range" />
      <GuessForm view={view} props={props} />
      <OwnGuesses view={view} props={props} />
    </div>
  );
}
