/**
 * @file   games/mind-games/web/PrefsPanel.tsx
 * @module games/mind-games/web
 * @brief  "Your pre-picks" in the waiting area: one choice or none per round, and the box.
 *
 * Responsibility: 02e §7 and §11, laid out as the owner's reference of 2026-11-15 (MG-N8):
 *                 "Your pre-picks" with "play for you while you are away" beside it (the whole
 *                 sentence, "Pre-picks play for you when you are away. If you are here, you can
 *                 still switch.", its tooltip); one row per round still to play, its label at
 *                 the left and its select at the right ("none, Spring, Summer, Autumn, Winter,
 *                 All"), each with its tooltip; at the foot the box "Hide my switches", which
 *                 every pre-pick carries into its round (02e §6.3, T309). On a phone the rounds
 *                 two to a row, the label above its select (./prefs.css). Before the series'
 *                 first round the
 *                 number of rounds is the setting's default. A change is saved 2.1 s after the
 *                 last one (./useSavedPrefs); a refusal is said in words. The value is the player's own:
 *                 the platform shows this panel to them alone.
 * Depends on:     react, @smg/game-sdk (PrefsPanelProps), @smg-game/mind-games (names,
 *                 settings), ./useSavedPrefs
 * Used by:        ./index
 * Spec:           docs/spec/02e-game-mind-games.md §7, §11
 */
import { CHOICE_NAMES, DEFAULT_CONFIG, type Choice } from '@smg-game/mind-games';
import type { PrefsPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { useSavedPrefs } from './useSavedPrefs.js';

const CHOICES: readonly Choice[] = ['spring', 'summer', 'autumn', 'winter', 'all'];

// What pre-picks do, whole, in the tooltip of the title's short line (the reference of MG-N8).
const ABOUT = 'Pre-picks play for you when you are away. If you are here, you can still switch.';

// The box every pre-pick carries into its round (02e §6.3, T309).
function HideBox(p: { readonly hide: boolean; readonly set: (hide: boolean) => void }) {
  return (
    <label className="mg-hide" title="Your switches show only in the counts, in every round.">
      <input
        type="checkbox"
        checked={p.hide}
        onChange={(e) => {
          p.set(e.target.checked);
        }}
      />{' '}
      Hide my switches
    </label>
  );
}

// One round's select.
function RoundPick(p: {
  readonly round: number;
  readonly value: string;
  readonly pick: (round: number, value: string) => void;
}): ReactElement {
  const n = String(p.round);
  return (
    <label
      className="mg-prefs-round"
      title={`Your first choice in round ${n} if you have not chosen by its start.`}
    >
      {/* The small label above its select (the design of MG-N7). */}
      <span>Round {p.round}</span>{' '}
      <select
        className="smg-select"
        value={p.value}
        onChange={(e) => {
          p.pick(p.round, e.target.value);
        }}
      >
        <option value="">none</option>
        {CHOICES.map((c) => (
          <option key={c} value={c}>
            {CHOICE_NAMES[c]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PrefsPanel(p: PrefsPanelProps): ReactElement | null {
  const { draft, note, change } = useSavedPrefs(p.prefs, p.save);
  // Only the rounds still to play (O97): one select each.
  const left = (p.rounds ?? DEFAULT_CONFIG.rounds) - p.played;
  const pick = (round: number, value: string): void => {
    // Every other round's pick, and this one's unless it is now none.
    const picks = Object.fromEntries([
      ...Object.entries(draft.picks).filter(([k]) => k !== String(round)),
      ...(value === '' ? [] : [[String(round), value as Choice] as const]),
    ]);
    change({ ...draft, picks });
  };
  if (left <= 0) return null;
  return (
    <section className="mg-prefs" aria-labelledby="mg-prefs-title">
      <p className="mg-prefs-head">
        <strong id="mg-prefs-title">Your pre-picks</strong>{' '}
        <span className="mg-prefs-what" title={ABOUT}>
          play for you while you are away
        </span>
      </p>
      {/* One row per round still to play; only this list scrolls when it does not fit. */}
      <div className="mg-prefs-rounds">
        {Array.from({ length: left }, (_, i) => p.played + i + 1).map((round) => (
          <RoundPick
            key={round}
            round={round}
            value={draft.picks[String(round)] ?? ''}
            pick={pick}
          />
        ))}
      </div>
      {note === null ? null : (
        <p role="status" className="mg-prefs-note">
          {note}
        </p>
      )}
      <HideBox
        hide={draft.hide ?? false}
        set={(hide) => {
          change({ ...draft, hide });
        }}
      />
    </section>
  );
}
