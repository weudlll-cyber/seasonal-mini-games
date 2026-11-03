/**
 * @file   apps/web/src/round/SpecialBanner.tsx
 * @module web/round
 * @brief  The short banner above the guess list when a season special fires (O35).
 *
 * Responsibility: for about 3 s after a special fires, one line in the season colour says
 *                 what happened: Leaf Fall's numbers falling and the range halved in the
 *                 game's words (its `banner` hook), Heatwave's new waiting time and Spring
 *                 Herald's hint in the platform's (./roundText); under Frost, for the first
 *                 3 s of the round, that answers arrive late (a held own answer is said by its
 *                 row in the list, "answer arriving… 3 s", not again here, O47). Derived from the live feed and the view on every tick, so no
 *                 timer of its own; the newest event wins. While the banner shows an event,
 *                 the list leaves that event's row out (`key`), so one view never says it
 *                 twice (O47); the row comes back once the banner is gone. A live region
 *                 announces each new line.
 * Depends on:     react, @smg/contracts, @smg-game/registry/web (types), ../live/useRound
 *                 (FeedItem), ./roundText, ./roundSpecials.css
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/03-seasonal-specials.md §2, §6; docs/spec/02-game-guess-the-number.md §12
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import type { ReactElement } from 'react';

import type { FeedItem } from '../live/useRound.js';
import { platformBanner } from './roundText.js';
import './roundSpecials.css';

// How long a banner stays (O35: about 3 s).
const BANNER_MS = 3_000;

function textOf(event: unknown, game: GameWeb | null): string | null {
  const e = event as { type?: string; event?: unknown };
  if (e.type === 'Game') return game?.text.banner?.(e.event) ?? null;
  return platformBanner(event);
}

// Frost in its first 3 s: the round opened with answers held (night-5 review: Frost had no
// sign of itself until the first guess).
function frostOpening(state: RoundStateView, now: number): string | null {
  if (state.frostDelayMs === null || state.opensAt === null) return null;
  if (now < state.opensAt || now - state.opensAt >= BANNER_MS) return null;
  return `Frost: answers arrive ${String(Math.round(state.frostDelayMs / 1_000))} s late.`;
}

// The banner's line, and the feed item it stands for (null for Frost's own lines).
export interface Banner {
  readonly text: string;
  readonly key: string | null;
}

// The banner to show now, or null: the newest special event of the last 3 s, else Frost's at
// the opening.
export function bannerOf(
  feed: readonly FeedItem[],
  state: RoundStateView,
  game: GameWeb | null,
  now: number,
): Banner | null {
  // The feed is newest first.
  for (const item of feed) {
    if (now - item.at >= BANNER_MS) continue;
    const text = textOf(item.event, game);
    if (text !== null) return { text, key: item.key };
  }
  // A held own answer is said by its row ("answer arriving… 3 s"), not again here (O47).
  const frost = frostOpening(state, now);
  return frost === null ? null : { text: frost, key: null };
}

export function SpecialBanner({ banner }: { readonly banner: Banner | null }): ReactElement {
  // The live region stays in the page, so each new line is announced; empty, it takes no room.
  return (
    <div className="round-special-banner" role="status" data-testid="special-banner">
      {banner === null ? null : <p>{banner.text}</p>}
    </div>
  );
}
