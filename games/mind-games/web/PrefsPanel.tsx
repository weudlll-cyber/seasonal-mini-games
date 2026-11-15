/**
 * @file   games/mind-games/web/PrefsPanel.tsx
 * @module games/mind-games/web
 * @brief  "Your pre-picks" in the waiting area: one choice or none per round, and the box.
 *
 * Responsibility: 02e §7 and §11, laid out as the design of MG-N7: the title "Your pre-picks"
 *                 with a small info icon whose tooltip and accessible name hold "Pre-picks play
 *                 for you when you are away. If you are here, you can still switch.", the box
 *                 "Hide my switches" (which every pre-pick carries into its round, 02e §6.3,
 *                 T309) at the right of that line; under it one select per round still to play
 *                 ("Round 4" above "none, Spring, Summer, Autumn, Winter, All"), each with its
 *                 tooltip, in one row of up to six. Before the series' first round the
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

// What pre-picks do, in the info icon's tooltip and accessible name (the design of MG-N7).
export const ABOUT =
  'Pre-picks play for you when you are away. If you are here, you can still switch.';

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
  // One row of selects, at most six to a row (three on a phone, ./prefs.css).
  const cols = { ['--mg-cols' as string]: String(Math.min(left, 6)) };
  return (
    <section className="mg-prefs" aria-labelledby="mg-prefs-title">
      <div className="mg-prefs-head">
        <h3 id="mg-prefs-title">Your pre-picks</h3>
        <span className="mg-info" role="img" aria-label={ABOUT} title={ABOUT} tabIndex={0}>
          i
        </span>
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
      </div>
      <div className="mg-prefs-rounds" style={cols}>
        {Array.from({ length: left }, (_, i) => p.played + i + 1).map((round) => (
          <RoundPick
            key={round}
            round={round}
            value={draft.picks[String(round)] ?? ''}
            pick={pick}
          />
        ))}
      </div>
    </section>
  );
}
