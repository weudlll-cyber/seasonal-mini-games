/**
 * @file   games/mind-games/web/useSavedPrefs.ts
 * @module games/mind-games/web
 * @brief  The player's pre-picks and box as they edit them, saved 2.1 s after the last change.
 *
 * Responsibility: one draft of the player's match value (02e §7: a pick per round and the box
 *                 "Hide my switches", T309), changed at once on the page and saved through the
 *                 platform's `save` 2.1 s after the last change, so two saves never come closer
 *                 than the server's one every 2 s (DECISIONS T299, T320); a short note of how the
 *                 saving went, a refusal in words. Used by the waiting area's panel, the
 *                 round's Pre-picks panel and the round's box (02e §6.3, §7); a newer saved value
 *                 replaces the draft unless a save of its own is waiting. The box's state is kept
 *                 with the account across matches, the picks with the match (O116).
 * Depends on:     react, @smg/game-sdk (PrefsPanelProps), @smg-game/mind-games (Choice)
 * Used by:        ./PrefsPanel, ./MindInput
 * Spec:           docs/spec/02e-game-mind-games.md §6.3, §7
 */
import type { Choice } from '@smg-game/mind-games';
import type { PrefsPanelProps } from '@smg/game-sdk';
import { useEffect, useRef, useState } from 'react';

// Waits this long after the last change before saving (the server takes one save per 2 s).
export const SAVE_AFTER_MS = 2_100;

const REFUSALS: Readonly<Record<string, string>> = {
  PREFS_INVALID: 'That pre-pick is not allowed.',
  RATE_LIMITED: 'Saved too quickly. Change it again in a moment.',
  FORBIDDEN: 'Join the match to set pre-picks.',
};

export interface Prefs {
  readonly picks: Readonly<Record<string, Choice>>;
  readonly hide?: boolean;
}

// No picks yet (an account's box alone, O116) reads as none.
const asPrefs = (value: unknown): Prefs => ({ picks: {}, ...((value as Prefs | null) ?? {}) });

// The value as the player edits it, and its saving 2.1 s after the last change.
export function useSavedPrefs(initial: unknown, save: PrefsPanelProps['save']) {
  const [draft, setDraft] = useState<Prefs>(() => asPrefs(initial));
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  // The saved value changed elsewhere (the round's box and its Pre-picks panel edit one value,
  // O117): take it over, unless this draft has a save of its own still waiting.
  const saved = JSON.stringify(initial ?? null);
  useEffect(() => {
    if (timer.current === null) setDraft(asPrefs(JSON.parse(saved)));
  }, [saved]);
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
