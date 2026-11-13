/**
 * @file   games/mind-games/web/PrefsPanel.tsx
 * @module games/mind-games/web
 * @brief  "Your pre-picks" in the waiting area: one choice or none per round, and the box.
 *
 * Responsibility: 02e §7 and §11. One compact select per round of the match ("Round 4: none,
 *                 Spring, Summer, Autumn, Winter, All"), rounds already played locked, each with
 *                 its tooltip; the box "Hide my switches" that every pre-pick carries into its
 *                 round (02e §6.3, T309); the line "Pre-picks play for you when you are away.
 *                 If you are here, you can still switch." Before the series' first round the
 *                 number of rounds is the setting's default. A change is saved 2.1 s after the
 *                 last one, so two saves never come closer than the server's one every 2 s
 *                 (DECISIONS T299); a refusal is said in words. The value is the player's own:
 *                 the platform shows this panel to them alone.
 * Depends on:     react, @smg/game-sdk (PrefsPanelProps), @smg-game/mind-games (names,
 *                 settings)
 * Used by:        ./index
 * Spec:           docs/spec/02e-game-mind-games.md §7, §11
 */
import { CHOICE_NAMES, DEFAULT_CONFIG, type Choice } from '@smg-game/mind-games';
import type { PrefsPanelProps } from '@smg/game-sdk';
import { useEffect, useRef, useState, type ReactElement } from 'react';

// Waits this long after the last change before saving (the server takes one save per 2 s).
export const SAVE_AFTER_MS = 2_100;

const CHOICES: readonly Choice[] = ['spring', 'summer', 'autumn', 'winter', 'all'];

const REFUSALS: Readonly<Record<string, string>> = {
  PREFS_INVALID: 'That pre-pick is not allowed.',
  RATE_LIMITED: 'Saved too quickly. Change it again in a moment.',
  FORBIDDEN: 'Join the match to set pre-picks.',
};

interface Prefs {
  readonly picks: Readonly<Record<string, Choice>>;
  readonly hide?: boolean;
}

const asPrefs = (value: unknown): Prefs => (value as Prefs | null) ?? { picks: {} };

// The value as the player edits it, and its saving 2.1 s after the last change.
function useDraft(initial: unknown, save: PrefsPanelProps['save']) {
  const [draft, setDraft] = useState<Prefs>(() => asPrefs(initial));
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const change = (next: Prefs): void => {
    setDraft(next);
    setNote('Saving…');
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void save(next).then((reply) => {
        setNote(
          reply.ok
            ? 'Saved.'
            : (REFUSALS[reply.code ?? ''] ?? 'Your pre-picks could not be saved. Try again.'),
        );
      });
    }, SAVE_AFTER_MS);
  };
  return { draft, note, change };
}

// One round's select; a played round is locked.
function RoundPick(p: {
  readonly round: number;
  readonly locked: boolean;
  readonly value: string;
  readonly pick: (round: number, value: string) => void;
}): ReactElement {
  const n = String(p.round);
  return (
    <label
      className="mg-prefs-round"
      title={
        p.locked
          ? `Round ${n} is played.`
          : `Your first choice in round ${n} if you have not chosen by its start.`
      }
    >
      Round {p.round}{' '}
      <select
        value={p.value}
        disabled={p.locked}
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

export function PrefsPanel(p: PrefsPanelProps): ReactElement {
  const { draft, note, change } = useDraft(p.prefs, p.save);
  const rounds = p.rounds ?? DEFAULT_CONFIG.rounds;
  const pick = (round: number, value: string): void => {
    // Every other round's pick, and this one's unless it is now none.
    const picks = Object.fromEntries([
      ...Object.entries(draft.picks).filter(([k]) => k !== String(round)),
      ...(value === '' ? [] : [[String(round), value as Choice] as const]),
    ]);
    change({ ...draft, picks });
  };
  return (
    <section className="mg-prefs" aria-labelledby="mg-prefs-title">
      <h3 id="mg-prefs-title">Your pre-picks</h3>
      <p className="smg-muted">
        Pre-picks play for you when you are away. If you are here, you can still switch.
      </p>
      <div className="mg-prefs-rounds">
        {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => (
          <RoundPick
            key={round}
            round={round}
            locked={round <= p.played}
            value={draft.picks[String(round)] ?? ''}
            pick={pick}
          />
        ))}
      </div>
      <label className="mg-hide" title="Your switches show only in the counts, in every round.">
        <input
          type="checkbox"
          checked={draft.hide ?? false}
          onChange={(e) => {
            change({ ...draft, hide: e.target.checked });
          }}
        />{' '}
        Hide my switches
      </label>
      {note === null ? null : (
        <p role="status" className="mg-prefs-note">
          {note}
        </p>
      )}
    </section>
  );
}
