// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/fitFonts.test.tsx
 * @module web/round
 * @brief  A screen's scale is fitted again when web fonts finish loading (O111, T404).
 *
 * Responsibility: the kit's `useFitScale` with `afterFonts` (the result screens' option) fits
 *                 its root at mount, again after `document.fonts` reports `loadingdone` (the
 *                 type swapped in after the first paint, font-display: swap, can wrap a line
 *                 anew; WebKit, journey 16), and no longer once the screen is gone; the kit's
 *                 `StartCard` does the same with the game's `fit` option (RoundIntro, K48);
 *                 and `useFontLoads`, the result frame's count of those loads for its
 *                 signature (the kit's frame has no such option). jsdom has no layout, so a
 *                 fitting shows as `data-sk-fit-scale` being written again.
 * Depends on:     vitest, @testing-library/react, react, @seasonal/kit/react, ./useFit
 * Spec:           docs/spec/04-software-architecture.md §4.6
 */
import { act, cleanup, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StartCard, useFitScale } from '@seasonal/kit/react';

import { useFontLoads } from './useFit.js';

function Card(): ReactElement {
  const ref = useFitScale<HTMLDivElement>('mini-games', 'card', false, { afterFonts: true });
  return <div ref={ref} data-testid="card" style={{ overflow: 'hidden' }} />;
}

// jsdom has no FontFaceSet: an event target with its `ready` in its place.
const fonts = Object.assign(new EventTarget(), { ready: Promise.resolve() });

beforeEach(() => {
  Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document, 'fonts');
});

describe('useFitScale with afterFonts', () => {
  it('fits again once fonts have loaded, and not after the screen is gone', async () => {
    const view = render(<Card />);
    const card = view.getByTestId('card');
    expect(card.dataset['skFitScale']).toBe('1');
    // The fit that follows `fonts.ready` has settled before the event is sent.
    await new Promise((r) => setTimeout(r, 50));
    delete card.dataset['skFitScale'];
    fonts.dispatchEvent(new Event('loadingdone'));
    await vi.waitFor(() => {
      expect(card.dataset['skFitScale']).toBe('1');
    });
    view.unmount();
    delete card.dataset['skFitScale'];
    fonts.dispatchEvent(new Event('loadingdone'));
    await new Promise((r) => setTimeout(r, 50));
    expect(card.dataset['skFitScale']).toBeUndefined();
  });
});

function Intro(): ReactElement {
  return (
    <StartCard
      game="mini-games"
      season={null}
      title="Card"
      opensIn={3}
      signature="a"
      fit={{ afterFonts: true }}
    />
  );
}

describe('the start card with the fit option the intro passes', () => {
  it('fits again once fonts have loaded', async () => {
    const view = render(<Intro />);
    const card = view.container.firstElementChild as HTMLElement;
    await new Promise((r) => setTimeout(r, 50));
    delete card.dataset['skFitScale'];
    fonts.dispatchEvent(new Event('loadingdone'));
    await vi.waitFor(() => {
      expect(card.dataset['skFitScale']).toBe('1');
    });
  });
});

function Loads(): ReactElement {
  return <span data-testid="loads">{useFontLoads()}</span>;
}

describe('useFontLoads', () => {
  it('counts the fonts loads while the result is shown', () => {
    const view = render(<Loads />);
    expect(view.getByTestId('loads').textContent).toBe('0');
    act(() => {
      fonts.dispatchEvent(new Event('loadingdone'));
      fonts.dispatchEvent(new Event('loadingdone'));
    });
    expect(view.getByTestId('loads').textContent).toBe('2');
  });
});
