// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/highlight.test.tsx
 * @module web/round
 * @brief  The round view's one highlighted player (O62), through the rows that set it.
 *
 * Responsibility: @smg/ui's highlight: hovering or focusing a row highlights its player in
 *                 every row (`data-hl` "on" for that player's, "off" for the others'), leaving
 *                 clears it; on a phone a tap keeps it for 3 s, and a later highlight is not
 *                 cleared by an earlier tap's end; a row without a player takes no part; `lit`
 *                 says how an element of several players shows. Fake timers.
 * Depends on:     vitest, @testing-library/react, react, @smg/ui
 * Spec:           docs/spec/02d-game-seasonal-target.md §11 (owner decision 62)
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { lit, setHighlight, useHighlightRow } from '@smg/ui';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function Row(p: { readonly who: string | null; readonly phone?: boolean }): ReactElement {
  const props = useHighlightRow(p.who, p.phone ?? false);
  return (
    <li data-testid={`row-${p.who ?? 'none'}`} {...props}>
      {p.who}
    </li>
  );
}

function List(p: { readonly phone?: boolean }): ReactElement {
  return (
    <ul>
      <Row who="anna" phone={p.phone} />
      <Row who="ben" phone={p.phone} />
      <Row who={null} phone={p.phone} />
    </ul>
  );
}

const hl = (who: string) => screen.getByTestId(`row-${who}`).getAttribute('data-hl');

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  act(() => {
    setHighlight(null);
  });
  cleanup();
  vi.useRealTimers();
});

describe('the highlighted player (O62)', () => {
  it('follows hover and focus on a desktop and clears on leaving', () => {
    render(<List />);
    expect(hl('anna')).toBeNull();
    fireEvent.mouseEnter(screen.getByTestId('row-anna'));
    expect([hl('anna'), hl('ben')]).toEqual(['on', 'off']);
    fireEvent.mouseLeave(screen.getByTestId('row-anna'));
    expect(hl('anna')).toBeNull();
    fireEvent.focus(screen.getByTestId('row-ben'));
    expect([hl('anna'), hl('ben')]).toEqual(['off', 'on']);
    fireEvent.blur(screen.getByTestId('row-ben'));
    expect(hl('ben')).toBeNull();
    // A desktop row is reachable by keyboard; a row without a player takes no part.
    expect(screen.getByTestId('row-anna').getAttribute('tabindex')).toBe('0');
    expect(screen.getByTestId('row-none').hasAttribute('data-hl')).toBe(false);
  });

  it('keeps a tapped player for 3 s on a phone, unless another is highlighted meanwhile', () => {
    render(<List phone />);
    fireEvent.click(screen.getByTestId('row-anna'));
    expect(hl('anna')).toBe('on');
    act(() => {
      vi.advanceTimersByTime(2_900);
    });
    expect(hl('anna')).toBe('on');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(hl('anna')).toBeNull();
    // A tap, then another player's: the first tap's end does not clear the second.
    fireEvent.click(screen.getByTestId('row-anna'));
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    fireEvent.click(screen.getByTestId('row-ben'));
    act(() => {
      vi.advanceTimersByTime(2_500);
    });
    expect(hl('ben')).toBe('on');
    expect(screen.getByTestId('row-anna').hasAttribute('tabindex')).toBe(false);
  });

  it('shows an element of several players as on, off or nothing', () => {
    expect(lit(null, ['anna'])).toBeUndefined();
    expect(lit('anna', ['ben', 'anna'])).toBe('on');
    expect(lit('anna', ['ben'])).toBe('off');
  });
});
