// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/fitFonts.test.tsx
 * @module web/round
 * @brief  A screen's scale is fitted again when web fonts finish loading (O111).
 *
 * Responsibility: `useFitScale` fits its root at mount, again in the next frame after
 *                 `document.fonts` reports `loadingdone` (the type swapped in after the first
 *                 paint, font-display: swap, can wrap a line anew; WebKit, journey 16), and no
 *                 longer once the screen is gone. jsdom has no layout, so a fitting shows as
 *                 `data-fit-scale` being written again.
 * Depends on:     vitest, @testing-library/react, react, ./useFit
 * Spec:           docs/spec/04-software-architecture.md §4.6
 */
import { cleanup, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFitScale } from './useFit.js';

function Card(): ReactElement {
  const ref = useFitScale<HTMLDivElement>('card');
  return <div ref={ref} data-testid="card" style={{ overflow: 'hidden' }} />;
}

// jsdom has no FontFaceSet: an event target in its place.
const fonts = new EventTarget();

beforeEach(() => {
  Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document, 'fonts');
});

describe('useFitScale and web fonts', () => {
  it('fits again once fonts have loaded, and not after the screen is gone', async () => {
    const view = render(<Card />);
    const card = view.getByTestId('card');
    expect(card.dataset['fitScale']).toBe('1');
    delete card.dataset['fitScale'];
    fonts.dispatchEvent(new Event('loadingdone'));
    await vi.waitFor(() => {
      expect(card.dataset['fitScale']).toBe('1');
    });
    view.unmount();
    delete card.dataset['fitScale'];
    fonts.dispatchEvent(new Event('loadingdone'));
    await new Promise((r) => setTimeout(r, 50));
    expect(card.dataset['fitScale']).toBeUndefined();
  });
});
