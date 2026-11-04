/**
 * @file   apps/web/src/round/SpecialBanner.tsx
 * @module web/round
 * @brief  The one-line banner in the head of the round's list when a season special fires.
 *
 * Responsibility: for 5 s after a special fires, one line in the season colour says what
 *                 happened: Leaf Fall's numbers falling and the range halved in the game's words
 *                 (its `banner` hook), Heatwave's new waiting time and Spring Herald's hint in
 *                 the platform's (./roundText); under Frost, for the first 5 s of the round and
 *                 on a phone only (a desktop's special line says it), that answers arrive late (a held own answer is said by its row, "answer
 *                 arriving… 3 s", O47). It takes the place of the list head's title, so it never
 *                 pushes the list down, and is cut with an ellipsis rather than wrapping (T142);
 *                 the event's own line stays in the All list (./RoundLog). Derived from the live
 *                 feed and the view on every tick, so no timer of its own; the newest event
 *                 wins. A live region announces each new line.
 * Depends on:     react, @smg/contracts, @smg-game/registry/web (types), ../live/useRound
 *                 (FeedItem), ./roundText, ./roundSpecials.css
 * Used by:        ./RoundBody, ./RoundLog
 * Spec:           docs/spec/03-seasonal-specials.md §2, §6; docs/spec/02-game-guess-the-number.md §12
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import type { ReactElement } from 'react';

import type { FeedItem } from '../live/useRound.js';
import { platformBanner } from './roundText.js';
import './roundSpecials.css';

// How long a banner stays (T142: 5 s).
export const BANNER_MS = 5_000;

function textOf(event: unknown, game: GameWeb | null): string | null {
  const e = event as { type?: string; event?: unknown };
  if (e.type === 'Game') return game?.text.banner?.(e.event) ?? null;
  return platformBanner(event);
}

// Frost at the opening: the round opened with answers held (night-5 review: Frost had no sign
// of itself until the first guess).
function frostOpening(state: RoundStateView, now: number): string | null {
  if (state.frostDelayMs === null || state.opensAt === null) return null;
  if (now < state.opensAt || now - state.opensAt >= BANNER_MS) return null;
  return `Frost: answers arrive ${String(Math.round(state.frostDelayMs / 1_000))} s late.`;
}

// The newest special event of the last 5 s in a line, or null. A desktop's banner is this
// alone: its special line says Frost's sentence already (night-7 review).
export function eventBanner(
  feed: readonly FeedItem[],
  game: GameWeb | null,
  now: number,
): string | null {
  // The feed is newest first.
  for (const item of feed) {
    if (now - item.at >= BANNER_MS) continue;
    const text = textOf(item.event, game);
    if (text !== null) return text;
  }
  return null;
}

// The phone's banner now, or null: the newest special event of the last 5 s, else Frost's at
// the opening.
export function bannerOf(
  feed: readonly FeedItem[],
  state: RoundStateView,
  game: GameWeb | null,
  now: number,
): string | null {
  return eventBanner(feed, game, now) ?? frostOpening(state, now);
}

export function SpecialBanner({ text }: { readonly text: string | null }): ReactElement {
  // The live region stays in the page, so each new line is announced; empty, it takes no room.
  return (
    <p
      className="round-banner"
      role="status"
      data-testid="special-banner"
      title={text ?? undefined}
    >
      {text}
    </p>
  );
}
