// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/tags.test.tsx
 * @module web/round
 * @brief  A game with player tags (O62): the rows' tags and markers, and the row's highlight.
 *
 * Responsibility: with `playerTags` every row starts with its player's marker and tag ("you"
 *                 for the viewer) in place of the dot, the other games' rows keep the dot;
 *                 hovering or focusing a row highlights its player and leaving clears it; a
 *                 tap on a phone keeps the highlight for 3 s; while a player is highlighted
 *                 their rows are marked 'on', the others 'off'; the Players panel shows the
 *                 same marker and tag; the result's placings take part in the highlight (T211).
 * Depends on:     vitest, @testing-library/react, @smg/contracts, @smg/game-sdk, @smg/ui,
 *                 ./fakes, ./RoundLog, ./RoundSide
 * Spec:           docs/spec/02d-game-seasonal-target.md §11
 */
import type { RoundStateView } from '@smg/contracts';
import { marksOf } from '@smg/game-sdk';
import { setHighlight, useHighlight } from '@smg/ui';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ended } from './fakes.js';
import { Placings } from './ResultParts.js';
import { RoundLog } from './RoundLog.js';
import { PlayersPanelBody } from './RoundSide.js';

afterEach(() => {
  act(() => {
    setHighlight(null);
  });
  cleanup();
  vi.useRealTimers();
});

const row = { pending: false, tier: null, feedback: 'higher' as const, value: 10, comment: null };
const own = { ...row, key: '1', at: 1_000, playerId: null };
const theirs = { ...row, key: '2', at: 2_000, playerId: 'w', value: 50 };
const gameOf = (tags: boolean) =>
  ({
    text: { code: () => null, event: () => null, guesses: () => [own, theirs] },
    ...(tags ? { playerTags: true } : {}),
  }) as never;
const open: RoundStateView = { ...ended, status: 'open', role: 'player', game: {} };

let seen: string | null = null;
function Spy(): null {
  seen = useHighlight();
  return null;
}

function show(tags: boolean, phone = false): HTMLElement[] {
  render(
    <>
      <Spy />
      <RoundLog
        feed={[]}
        game={gameOf(tags)}
        state={open}
        viewerKey="a"
        now={4_000}
        kind="main"
        phone={phone}
      />
    </>,
  );
  return screen.getAllByRole('listitem');
}

describe('rows of a game with player tags (O62)', () => {
  it("start with the player's marker and tag, the viewer's row with its tag only", () => {
    const [mine, w] = show(true).reverse();
    expect(mine?.querySelector('.smg-mark-tag')?.textContent).toBe('you');
    // The viewer's row says "you" once; "You" only for a screen reader (T204).
    expect(mine?.querySelector('.round-who')).toBeNull();
    expect(mine?.querySelector('.smg-visually-hidden')?.textContent).toBe('You');
    expect(w?.querySelector('.round-who')?.textContent).toBe('Walter');
    expect(w?.querySelector('.smg-mark-tag')?.textContent).toBe('w');
    expect(w?.querySelector('.round-dot')).toBeNull();
  });

  it('are kept with their dot in the other games', () => {
    const plain = show(false);
    expect(plain[0]?.querySelector('.round-dot')).not.toBeNull();
    expect(plain[0]?.querySelector('.smg-mark')).toBeNull();
  });

  it('highlight their player on hover and focus, and mark the rows on and off', () => {
    const [mine, w] = show(true).reverse();
    fireEvent.mouseEnter(w as HTMLElement);
    expect(seen).toBe('w');
    expect(w?.dataset['hl']).toBe('on');
    expect(mine?.dataset['hl']).toBe('off');
    fireEvent.mouseLeave(w as HTMLElement);
    expect(seen).toBeNull();
    fireEvent.focus(mine as HTMLElement);
    expect(seen).toBe('a');
    fireEvent.blur(mine as HTMLElement);
    expect(seen).toBeNull();
  });

  it('keep the highlight for 3 s after a tap on a phone', () => {
    vi.useFakeTimers();
    const [, w] = show(true, true).reverse();
    fireEvent.click(w as HTMLElement);
    expect(seen).toBe('w');
    act(() => {
      vi.advanceTimersByTime(2_900);
    });
    expect(seen).toBe('w');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(seen).toBeNull();
  });
});

describe('the Players panel with player tags', () => {
  it('shows the same marker and tag beside the name', () => {
    const marks = marksOf(
      open.roster.map((r) => r.playerKey),
      'a',
    );
    render(<PlayersPanelBody state={open} points={[]} viewerKey="a" marks={marks} />);
    const tags = screen.getAllByTestId('player-mark').map((m) => m.textContent);
    expect(tags).toEqual(['you', 'w']);
  });
});

describe('the placings with player tags (T211)', () => {
  it("take part in the grid's highlight: a row's hover highlights its player", () => {
    const marks = marksOf(
      ended.roster.map((r) => r.playerKey),
      'a',
    );
    render(
      <>
        <Spy />
        <Placings state={ended} viewerKey="a" marks={marks} />
      </>,
    );
    const rows = [...screen.getByTestId('placings').querySelectorAll('tbody tr')];
    // No marker in the placings: the name says who, the room goes to it.
    expect(rows.map((r) => r.querySelector('.smg-mark'))).toEqual([null, null]);
    fireEvent.mouseEnter(rows[0] as HTMLElement);
    expect(seen).toBe('w');
    expect((rows[1] as HTMLElement).dataset['hl']).toBe('off');
  });
});
