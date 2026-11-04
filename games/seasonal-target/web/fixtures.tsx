/**
 * @file   games/seasonal-target/web/fixtures.tsx
 * @module games/seasonal-target/web
 * @brief  Builders for the screens' tests: views, guesses, the input, and a measured screen.
 *
 * Responsibility: a 20 × 20 player view, own and others' guesses, the platform's props for the
 *                 input (the list's names and colours, T125) and the input rendered with them
 *                 and a ring, and `screenOf`, which stands in for the browser's ResizeObserver
 *                 (the grid's content box drawn `px` wide) and the phone media query, since
 *                 jsdom has neither.
 * Depends on:     vitest, @testing-library/react, @smg-game/seasonal-target (types), ./TargetInput
 * Used by:        ./input.test, ./panels.test
 * Spec:           docs/spec/09-testing-strategy.md §2
 */
import type { Feedback, PlayerView } from '@smg-game/seasonal-target';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

import { TargetInput } from './TargetInput.js';

export const ne = { kind: 'direction', distance: 9, direction: 'NE', tier: 'cold' } as const;

// The platform's list: each player's name and one colour (T125).
export const roster = {
  names: { a: 'Walter', b: 'Anna' },
  colors: { a: 'var(--color-summer)', b: 'var(--color-winter)' },
};

const seen = { tier: null, comment: null };

export const own = (seq: number, x: number, y: number, feedback: Feedback | null) => ({
  receiveSeq: seq,
  receivedAt: 0,
  value: { x, y },
  feedback,
  ...seen,
});

// Another player's guess: `other('b', own(2, 9, 9, ne))`; `held` while Frost holds its
// answer (T150).
export const other = (playerId: string, guess: ReturnType<typeof own>, held = false) => ({
  ...guess,
  playerId,
  held,
});

export function playerView(over: Partial<PlayerView> = {}): PlayerView {
  return {
    map: { width: 20, height: 20 },
    feedbackMode: 'direction',
    repeatRejected: true,
    area: { left: 1, right: 20, top: 1, bottom: 20 },
    hint: null,
    fallen: [],
    guesses: [],
    log: [],
    ...over,
  };
}

// The platform's props for the input: Guess answered `ok`, no Frost, a spring round.
export function props(view: PlayerView, canAct = true, waitS: number | null = null) {
  return {
    view,
    act: vi.fn(() => Promise.resolve({ ok: true })),
    canAct,
    waitS,
    ...roster,
    frostDelayMs: null,
    now: () => 0,
    season: 'spring' as const,
    specialOn: true,
  };
}

export function renderInput(view: PlayerView, canAct = true, waitS: number | null = null) {
  const p = props(view, canAct, waitS);
  render(<TargetInput {...p} ring={<span data-testid="ring" />} />);
  return p.act;
}

// What a tile says, without its corner tag (O62): the distance, the glyph or "…".
export const faceOf = (tile: Element | null | undefined): string =>
  tile?.querySelector('.st-face')?.textContent ?? '';

// A browser whose grids are drawn `px` wide, a phone's or not.
export function screenOf(px: number, phone: boolean): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly report: ResizeObserverCallback) {}
      observe(): void {
        this.report(
          [{ contentRect: { width: px } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      disconnect(): void {}
    },
  );
  window.matchMedia = (query: string) =>
    ({
      matches: phone,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
}

// Back to jsdom's own: no ResizeObserver, no matchMedia.
export function plainScreen(): void {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'matchMedia');
}
