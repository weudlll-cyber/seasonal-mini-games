// @vitest-environment jsdom
/**
 * @file   games/mind-games/web/prefs.test.tsx
 * @module games/mind-games/web
 * @brief  Your pre-picks: one select per round, played rounds locked, the box, the saving.
 *
 * Responsibility: the panel's part of MG6 (09 §3): a select per round of the series (the
 *                 setting's default before its first round), each with its tooltip, played
 *                 rounds locked; a change saved once, 2.1 s after the last one, as a value the
 *                 game's own prefs schema takes (none removes a round's pick; the box rides
 *                 along); a refusal in words; the saved value shown again from `prefs`.
 * Depends on:     vitest, @testing-library/react, @smg-game/mind-games (module), ./PrefsPanel
 * Spec:           docs/spec/02e-game-mind-games.md §7, §11; docs/spec/09-testing-strategy.md §3 (MG6)
 */
import { mindGames } from '@smg-game/mind-games';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PrefsPanel } from './PrefsPanel.js';
import { SAVE_AFTER_MS } from './useSavedPrefs.js';

const ok = () => vi.fn((_prefs: unknown) => Promise.resolve({ ok: true }));
const selects = () => screen.getAllByRole<HTMLSelectElement>('combobox');

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Mind Games pre-picks panel (02e §7)', () => {
  it('has a select per round, the default number before the first round, played ones locked', () => {
    render(<PrefsPanel prefs={null} rounds={null} played={0} save={ok()} />);
    expect(selects()).toHaveLength(6);
    cleanup();
    render(<PrefsPanel prefs={{ picks: { '1': 'winter' } }} rounds={3} played={1} save={ok()} />);
    expect(selects().map((s) => [s.value, s.disabled])).toEqual([
      ['winter', true],
      ['', false],
      ['', false],
    ]);
    expect(screen.getByText(/Round 2/).closest('label')?.title).toBe(
      'Your first choice in round 2 if you have not chosen by its start.',
    );
    expect(screen.getByText(/Pre-picks play for you when you are away/)).toBeTruthy();
  });

  it('saves once, 2.1 s after the last change, a value the game takes', async () => {
    const save = ok();
    render(<PrefsPanel prefs={{ picks: { '1': 'winter' } }} rounds={3} played={0} save={save} />);
    fireEvent.change(selects()[1] as HTMLSelectElement, { target: { value: 'all' } });
    fireEvent.change(selects()[0] as HTMLSelectElement, { target: { value: '' } });
    fireEvent.click(screen.getByLabelText('Hide my switches'));
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(SAVE_AFTER_MS);
      await Promise.resolve();
    });
    expect(save.mock.calls).toEqual([[{ picks: { '2': 'all' }, hide: true }]]);
    const schema = mindGames.phased?.prefs?.schema;
    expect(schema?.safeParse(save.mock.calls[0]?.[0]).success).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('Saved.');
  });

  it('says a refusal in words', async () => {
    const save = vi.fn((_prefs: unknown) => Promise.resolve({ ok: false, code: 'PREFS_INVALID' }));
    render(<PrefsPanel prefs={null} rounds={2} played={0} save={save} />);
    fireEvent.change(selects()[0] as HTMLSelectElement, { target: { value: 'spring' } });
    await act(async () => {
      vi.advanceTimersByTime(SAVE_AFTER_MS);
      await Promise.resolve();
    });
    expect(screen.getByRole('status').textContent).toBe('That pre-pick is not allowed.');
  });
});
