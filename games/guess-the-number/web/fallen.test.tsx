// @vitest-environment jsdom
/**
 * @file   games/guess-the-number/web/fallen.test.tsx
 * @module games/guess-the-number/web
 * @brief  The fallen numbers in the panel of a Leaf Fall round (O58) and Leaf Fall's list row.
 *
 * Responsibility: the panel lists every fallen number ascending, plain (no strike-through) with
 *                 thousands separators, and names the count, only in an autumn round with its
 *                 special on, without a button to open; when the list's three rows hold fewer
 *                 numbers than fell, "+N more" opens all of them as a sheet that Escape closes;
 *                 "None yet." before the first fall; the phone's line names the count and the
 *                 newest three, newest first; the Leaf Fall row is the special's (`special`).
 * Depends on:     vitest, @testing-library/react, ./InfoLine, ./PlayerPanel, ./SpectatorPanel,
 *                 ./text
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §2.3
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InfoLine } from './InfoLine.js';
import { PlayerPanel } from './PlayerPanel.js';
import { SpectatorPanel } from './SpectatorPanel.js';
import { gtnText } from './text.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const view = {
  range: { low: 1, high: 1_000 },
  removed: [5, 6],
  newest: [5, 6],
  guesses: [],
  log: [],
  hint: null,
};

// The platform's per-player props: no cooldown running, no names or colours needed here.
const who = { waitS: null, names: {}, colors: {} };
const base = { act: vi.fn(), canAct: false, frostDelayMs: null, now: () => 0, ...who };
const fallen = { ...view, removed: [7, 1_500, 250_000], newest: [250_000, 7, 1_500] };

// A laid-out list: three rows of 24 px, four chips a row, so 12 of 20 show whole.
function layOut(): void {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.tagName === 'UL' ? 80 : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(24);
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    const i = Array.from(this.parentElement?.children ?? []).indexOf(this);
    return Math.floor(i / 4) * 28;
  });
}

describe('the fallen numbers in the panel (O58)', () => {
  it('lists every fallen number ascending and plain, in a Leaf Fall round only', () => {
    render(<PlayerPanel {...base} view={fallen} season="autumn" specialOn />);
    expect(screen.getByTestId('fallen').textContent).toBe('Fallen numbers (3)');
    const list = screen.getByTestId('fallen-list');
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['7', '1,500', '250,000']);
    // Nothing to open: every number fits, so there is no "+N more".
    expect(screen.queryByTestId('fallen-more')).toBeNull();
    expect(screen.queryByTestId('fallen-toggle')).toBeNull();
    cleanup();
    render(<PlayerPanel {...base} view={fallen} season="autumn" specialOn={false} />);
    expect(screen.queryByTestId('fallen-panel')).toBeNull();
    cleanup();
    render(<SpectatorPanel view={fallen} names={{}} colors={{}} season="spring" specialOn />);
    expect(screen.queryByTestId('fallen-panel')).toBeNull();
  });

  it('shows as many as fit, then "+N more" opens all of them, closed by Escape', () => {
    layOut();
    const removed = Array.from({ length: 20 }, (_, i) => (i + 1) * 10);
    render(
      <SpectatorPanel
        view={{ ...view, removed }}
        names={{}}
        colors={{}}
        season="autumn"
        specialOn
      />,
    );
    const more = screen.getByTestId('fallen-more');
    expect(more.textContent).toBe('+8 more');
    const panel = screen.getByTestId('fallen-panel');
    fireEvent.click(more);
    expect(panel.dataset['open']).toBe('true');
    expect(within(screen.getByTestId('fallen-all')).getAllByRole('listitem')).toHaveLength(20);
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(panel.dataset['open']).toBe('false');
  });

  it('says so while nothing has fallen', () => {
    render(<PlayerPanel {...base} view={{ ...view, removed: [] }} season="autumn" specialOn />);
    expect(screen.getByTestId('fallen-panel').textContent).toContain('None yet.');
  });
});

describe("the fallen numbers on the phone's line (O58)", () => {
  it('names the count and the newest three, newest first', () => {
    render(<InfoLine view={fallen} names={{}} colors={{}} season="autumn" specialOn />);
    expect(screen.getByTestId('gtn-line-fallen').textContent).toBe('Fallen 3: 1,500, 7, 250,000');
    cleanup();
    render(
      <InfoLine view={{ ...view, removed: [], newest: [] }} {...who} season="autumn" specialOn />,
    );
    expect(screen.getByTestId('gtn-line-fallen').textContent).toBe('Fallen 0');
  });
});

describe("Leaf Fall's list row", () => {
  it('names the fallen numbers in a row marked as the special’s', () => {
    expect(gtnText.event({ type: 'NumbersRemoved', index: 1, numbers: [3, 1_200] }, {})).toEqual({
      text: 'Leaf Fall: 3 and 1,200 fell.',
      playerId: null,
      special: true,
    });
  });
});
