/**
 * @file   apps/web/src/round/SpecialBanner.tsx
 * @module web/round
 * @brief  The short banner above the guess list when a season special fires (O35).
 *
 * Responsibility: for about 3 s after a special fires, one line in the season colour says
 *                 what happened: Leaf Fall's numbers falling and the range halved in the
 *                 game's words (its `banner` hook), Heatwave's new waiting time and Spring
 *                 Herald's hint in the platform's (./roundText); under Frost, while the
 *                 viewer's newest guess has just been sent and its answer is held, when it
 *                 will arrive. Derived from the live feed and the view on every tick, so no
 *                 timer of its own; the newest event wins. The same events keep their rows
 *                 in the guess list. A live region announces each new line.
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

// Frost: the viewer's guess sent in the last 3 s whose answer is still held.
function frostText(state: RoundStateView, game: GameWeb | null, now: number): string | null {
  if (state.frostDelayMs === null || game === null || state.game === null) return null;
  const held = game.text
    .guesses(state.game)
    .filter((g) => g.playerId === null && g.pending && now - g.at < BANNER_MS);
  const newest = Math.max(...held.map((g) => g.at));
  if (!Number.isFinite(newest)) return null;
  const left = Math.max(1, Math.ceil((newest + state.frostDelayMs - now) / 1_000));
  return `Frost: your answer arrives in ${String(left)} s.`;
}

// The banner to show now, or null: the newest special event of the last 3 s, else Frost's.
export function bannerOf(
  feed: readonly FeedItem[],
  state: RoundStateView,
  game: GameWeb | null,
  now: number,
): string | null {
  // The feed is newest first.
  for (const item of feed) {
    if (now - item.at >= BANNER_MS) continue;
    const text = textOf(item.event, game);
    if (text !== null) return text;
  }
  return frostText(state, game, now);
}

export function SpecialBanner(p: {
  readonly feed: readonly FeedItem[];
  readonly state: RoundStateView;
  readonly game: GameWeb | null;
  readonly now: number;
}): ReactElement {
  const text = bannerOf(p.feed, p.state, p.game, p.now);
  // The live region stays in the page, so each new line is announced; empty, it takes no room.
  return (
    <div className="round-special-banner" role="status" data-testid="special-banner">
      {text === null ? null : <p>{text}</p>}
    </div>
  );
}
