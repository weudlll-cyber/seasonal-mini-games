// @vitest-environment jsdom
/**
 * @file   games/mind-games/web/phases.test.tsx
 * @module games/mind-games/web
 * @brief  The round's phases on screen, the round's box in the prefs, a refused pre-pick.
 *
 * Responsibility: with the round's public timing (the defaults 120/30/60): the next change in
 *                 words through Join, Play and Replay; the feed's sentences (the first choices'
 *                 countdown, every change a switch, the replay); the screen reader's sentence
 *                 per phase; the strip's markers; the buttons off after the join time for a
 *                 player not in the round, with the reason, and on for one in it; the box from
 *                 the player's prefs, saved there 2.1 s after a change; the notice of a pre-pick
 *                 the round refused, live and after a reconnect.
 * Depends on:     vitest, @testing-library/react, ./fixtures, ./MindInput, ./phases,
 *                 ./useSavedPrefs
 * Spec:           docs/spec/02e-game-mind-games.md §4, §6, §7, §11; docs/spec/09-testing-strategy.md §4.2
 */
import type { OwnMatchPart, PhasedTiming } from '@smg/game-sdk';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { inputProps, playerView } from './fixtures.js';
import { MindInput } from './MindInput.js';
import { announcement, feedNote, nextChange, phaseOf } from './phases.js';
import { SAVE_AFTER_MS } from './useSavedPrefs.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const plan = { entryEndMs: 60_000, actionsEndMs: 90_000, endMs: 120_000, viewDelayMs: 30_000 };
const at = (ms: number): PhasedTiming => ({ opensAt: 1_000, plan, now: () => 1_000 + ms });

describe('Mind Games phases in words (02e §4, §6, §11)', () => {
  it('names the next change through every phase', () => {
    expect(nextChange(at(36_000))).toBe('Joining closes in 0:24 · choices close in 0:54');
    expect(nextChange(at(78_000))).toBe('Choices close in 0:12');
    expect(nextChange(at(102_000))).toBe('Replay · result in 0:18');
    expect([10_000, 70_000, 100_000, 130_000].map((ms) => phaseOf(at(ms)))).toEqual([
      'join',
      'play',
      'replay',
      'over',
    ]);
    expect(announcement('play')).toBe('Joining has closed.');
    expect(announcement('replay')).toBe('Choices are closed.');
  });

  it('says what the feed shows: its countdown, every change a switch, the replay', () => {
    expect(feedNote(at(18_000), 0, true)).toBe('The first choices show in 12 s.');
    expect(feedNote(at(40_000), 5, false)).toBeNull();
    expect(feedNote(at(91_000), 23, false)).toBe(
      'Choices are closed. Replay of the last 30 s of play — the result follows in 29 s.',
    );
    // Journey 38's timings (60/10/30): the feed passes the join time at 40 s, before play ends.
    const short = { entryEndMs: 30_000, actionsEndMs: 50_000, endMs: 60_000, viewDelayMs: 10_000 };
    const t45 = { opensAt: 0, plan: short, now: () => 45_000 };
    expect(feedNote(t45, 23, false)).toBe('All 23 players are in. Every change now is a switch.');
  });
});

describe('Mind Games input with the round timing (02e §5.2, §11)', () => {
  it('shows the strip’s markers and next change', () => {
    render(<MindInput {...inputProps(playerView([], 0))} timing={at(36_000)} />);
    expect(screen.getByTestId('next-change').textContent).toBe(
      'Joining closes in 0:24 · choices close in 0:54',
    );
    expect(document.querySelector('.mg-marker-now')?.getAttribute('style')).toContain('left: 30%');
  });

  it('holds a player not in the round after the join time, with the reason', () => {
    render(<MindInput {...inputProps(playerView([], 0))} timing={at(61_000)} />);
    const radios = screen.getAllByRole<HTMLButtonElement>('radio');
    expect(radios.every((r) => r.disabled)).toBe(true);
    expect(document.querySelector('.mg-refusal')?.textContent).toBe(
      'Joining this round has closed. You can play the next round.',
    );
    cleanup();
    render(<MindInput {...inputProps(playerView([['me', 'winter']], 0))} timing={at(61_000)} />);
    expect(screen.getAllByRole<HTMLButtonElement>('radio').some((r) => !r.disabled)).toBe(true);
  });
});

describe('Mind Games own part of the match (02e §6.3, §7)', () => {
  const own = (over: Partial<OwnMatchPart> = {}): OwnMatchPart => ({
    roundIndex: 2,
    prefs: { picks: { '2': 'all' }, hide: true },
    save: vi.fn((_prefs: unknown) => Promise.resolve({ ok: true })),
    refusedPrePick: null,
    ...over,
  });

  it('starts the box from the prefs and saves it there', async () => {
    vi.useFakeTimers();
    const part = own({ prefs: { picks: {}, hide: true } });
    render(<MindInput {...inputProps(playerView([], 0))} own={part} />);
    const box = screen.getByLabelText<HTMLInputElement>('Hide my switches');
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    await act(async () => {
      vi.advanceTimersByTime(SAVE_AFTER_MS);
      await Promise.resolve();
    });
    expect(part.save).toHaveBeenCalledWith({ picks: {}, hide: false });
  });

  it('tells a refused pre-pick to its player, after a reconnect and as it arrives', () => {
    render(<MindInput {...inputProps(playerView([], 0))} own={own()} />);
    expect(screen.getByRole('status').textContent).toBe(
      'Your pre-pick All was not offered in round 2.',
    );
    cleanup();
    const live = own({ prefs: { picks: { '2': 'spring' } }, refusedPrePick: 'JOIN_CLOSED' });
    render(<MindInput {...inputProps(playerView([], 0))} own={live} />);
    expect(screen.getByRole('status').textContent).toBe(
      'Your pre-pick for round 2 was not taken: Joining this round has closed. You can play the next round.',
    );
    cleanup();
    render(<MindInput {...inputProps(playerView([['me', 'winter']], 0))} own={own()} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
