// @vitest-environment jsdom
/**
 * @file   games/mind-games/web/input.test.tsx
 * @module games/mind-games/web
 * @brief  The player's stage: the choice row, the counts, Hide my switches and refusals.
 *
 * Responsibility: four buttons, five with All, as a radio group with their tooltips; the
 *                 current choice pressed with a check and "Your choice"; the counts the view
 *                 holds under each, never more; a click sends `{ value: { choice, hide } }` at
 *                 once, the current choice nothing; the box only in a `perPlayer` round, sent
 *                 with the choice; a refusal in the game's words; the arrow keys move between
 *                 the buttons; no choosing while the round does not let the player act.
 * Depends on:     vitest, @testing-library/react, ./fixtures, ./MindInput
 * Spec:           docs/spec/02e-game-mind-games.md §5, §6.3, §11; docs/spec/09-testing-strategy.md §4.2
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { inputProps, playerView } from './fixtures.js';
import { MindInput } from './MindInput.js';

afterEach(cleanup);

// anna chose at 0 s, the viewer at 1 s; the feed has reached 0.5 s.
const view = playerView(
  [
    ['anna', 'summer'],
    ['me', 'winter'],
  ],
  500,
);

describe('Mind Games input (02e §5, §11)', () => {
  it('draws the choices as a radio group with the current one pressed and every tooltip', () => {
    render(<MindInput {...inputProps(view)} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual([
      'Spring',
      'Summer',
      'Autumn',
      'Winter✓ Your choice',
    ]);
    expect(screen.getByRole('radio', { name: /Winter/ }).getAttribute('aria-checked')).toBe('true');
    expect(radios[0]?.getAttribute('title')).toBe('Choose Spring. You can switch until 1:30.');
    expect(screen.getByLabelText('Hide my switches').closest('label')?.title).toBe(
      'While this is ticked, your switches show only in the counts.',
    );
  });

  it('shows the feed’s counts only: the viewer’s own live choice is not yet among them', () => {
    render(<MindInput {...inputProps(view)} />);
    expect(screen.getByTestId('count-summer').textContent).toBe('30 s ago: 1');
    expect(screen.getByTestId('count-winter').textContent).toBe('30 s ago: 0');
  });

  it('sends a click at once with the box, and nothing for the current choice', () => {
    const act = vi.fn(() => Promise.resolve({ ok: true }));
    render(<MindInput {...inputProps(view, act)} />);
    fireEvent.click(screen.getByLabelText('Hide my switches'));
    fireEvent.click(screen.getByRole('radio', { name: /Autumn/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Winter/ }));
    expect(act.mock.calls).toEqual([[{ value: { choice: 'autumn', hide: true } }]]);
  });
});

describe('Mind Games input replies and keys (02e §5.2, §11)', () => {
  it('says a refusal in the game’s words', async () => {
    const act = vi.fn(() => Promise.resolve({ ok: false, code: 'JOIN_CLOSED' }));
    render(<MindInput {...inputProps(playerView([], 0), act)} />);
    fireEvent.click(screen.getByRole('radio', { name: /Spring/ }));
    expect((await screen.findByRole('status')).textContent).toBe(
      'Joining this round has closed. You can play the next round.',
    );
  });

  it('shows no count while the feed is empty', () => {
    render(<MindInput {...inputProps(playerView([], 0))} />);
    expect(document.querySelectorAll('.mg-count')).toHaveLength(0);
  });

  it('offers All with its option, and the box only where each player decides', () => {
    render(
      <MindInput
        {...inputProps(playerView([], 0, { allOption: true, switchVisibility: 'visible' }))}
      />,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.queryByLabelText('Hide my switches')).toBeNull();
  });

  it('moves between the buttons with the arrow keys, one tab stop', () => {
    render(<MindInput {...inputProps(view)} />);
    const winter = screen.getByRole('radio', { name: /Winter/ });
    expect(screen.getAllByRole('radio').filter((r) => r.tabIndex === 0)).toEqual([winter]);
    winter.focus();
    fireEvent.keyDown(winter, { key: 'ArrowRight' });
    expect(document.activeElement?.textContent).toBe('Spring');
    fireEvent.keyDown(document.activeElement ?? winter, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(winter);
  });

  it('chooses nothing while the round does not let the player act', () => {
    render(<MindInput {...inputProps(view)} canAct={false} />);
    expect(screen.getAllByRole('radio').every((r) => (r as HTMLButtonElement).disabled)).toBe(true);
  });
});
