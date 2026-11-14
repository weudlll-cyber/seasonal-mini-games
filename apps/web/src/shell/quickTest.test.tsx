// @vitest-environment jsdom
/**
 * @file   apps/web/src/shell/quickTest.test.tsx
 * @module web/shell
 * @brief  Heatwave's step and interval in the Quick Test form, which sets up the first round (O63).
 *
 * Responsibility: the form shows "Heatwave step" and "Heatwave every" only with summer chosen,
 *                 from the definitions' defaults and bounds (the host form's own fields), and
 *                 the request body carries both for a summer round and neither otherwise. The
 *                 chosen game's word on its fields, as in the host form (T344): Mind Games' delay
 *                 shows a quarter of the total (O96) and its join time half of it, off, with
 *                 their help lines, while their "… follows the total" is on, and each is the
 *                 field's own once its box is off; a guess game's fields
 *                 stay the definitions' own.
 * Depends on:     vitest, @testing-library/react, ./QuickTest, ./quickTestSettings
 * Spec:           docs/spec/03-seasonal-specials.md §2.2; docs/spec/11-roadmap.md (Quick Test)
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QuickTest } from './QuickTest.js';
import { bodyOf, START, type Extra } from './quickTestSettings.js';

// The game list: one guess game and one phased game (T334).
const GAMES = [
  {
    id: 'guess-the-number',
    name: 'Guess The Number',
    secretModes: ['shared'],
    teams: true,
    timing: 'cooldown',
  },
  {
    id: 'mind-games',
    name: 'Seasonal Mind Games',
    secretModes: [],
    teams: false,
    timing: 'phased',
  },
];
vi.mock('./http.js', () => ({
  api: () => Promise.resolve({ games: GAMES }),
  ApiError: class extends Error {},
  BASE_PATH: '/',
}));

afterEach(() => {
  cleanup();
});

const field = (label: string) => screen.queryByLabelText<HTMLInputElement>(label);
const season = (value: string) => {
  const select = document.querySelector('select:has(option[value="summer"])') as HTMLElement;
  fireEvent.change(select, { target: { value } });
};

describe('Heatwave in the Quick Test form (O63, T208)', () => {
  it('shows step and interval only for summer, with their defaults and bounds', () => {
    render(<QuickTest />);
    expect(field('Heatwave step')).toBeNull();
    season('summer');
    expect(field('Heatwave step')?.value).toBe('1');
    expect(field('Heatwave every')?.value).toBe('10');
    expect([field('Heatwave every')?.min, field('Heatwave every')?.max]).toEqual(['5', '300']);
    season('winter');
    expect(field('Heatwave step')).toBeNull();
  });

  it('sends them for a summer round, and not for another', () => {
    const extra: Extra = {
      gameId: 'seasonal-target',
      seedText: 'acorn',
      season: 'summer',
      bots: 19,
      fast: true,
      lobby: true,
      teamMatch: true,
    };
    const values = { ...START, 'summer.stepS': 2, 'summer.stepIntervalS': 15 };
    expect(bodyOf(values, extra).settings).toMatchObject({
      'summer.stepS': 2,
      'summer.stepIntervalS': 15,
    });
    expect(bodyOf(values, { ...extra, season: 'autumn' }).settings).not.toHaveProperty(
      'summer.stepS',
    );
  });
});

describe('the fields of the chosen game (DECISIONS T334)', () => {
  const labels = () =>
    [...document.querySelectorAll('label')].map((l) => l.firstChild?.textContent?.trim());

  it('keeps the fields of a guess game and gives a phased game only those it uses', async () => {
    render(<QuickTest />);
    const game = await screen.findByTestId('quick-game');
    await screen.findByRole('option', { name: 'Seasonal Mind Games' });
    for (const label of ['Cooldown', 'Inactivity limit', 'Fast specials', 'Team match', 'Secret'])
      expect(labels()).toContain(label);
    fireEvent.change(game, { target: { value: 'mind-games' } });
    for (const label of ['Cooldown', 'Inactivity limit', 'Fast specials', 'Team match', 'Secret'])
      expect(labels()).not.toContain(label);
    for (const label of ['Seed', 'Bots', 'Countdown before opening', 'Total length', 'Delay'])
      expect(labels()).toContain(label);
  });
});

describe('the game’s word on its fields in the Quick Test (T344)', () => {
  it('keeps a guess game’s fields, and shows Mind Games’ delay and join time following the total', async () => {
    render(<QuickTest />);
    const game = await screen.findByTestId('quick-game');
    await screen.findByRole('option', { name: 'Seasonal Mind Games' });
    expect(field('Cooldown')?.disabled).toBe(false);
    fireEvent.change(game, { target: { value: 'mind-games' } });
    const total = field('Total length');
    if (total === null) throw new Error('the total');
    fireEvent.change(total, { target: { value: '40' } });
    fireEvent.blur(total);
    // A quarter of the total and half of it, off, each with its line (O96, O78).
    const delay = () => field('Delay');
    expect([delay()?.value, delay()?.disabled]).toEqual(['10', true]);
    expect(screen.getByText(/Follows the total: a quarter of it/)).toBeTruthy();
    const setTotal = (value: string) => {
      fireEvent.change(total, { target: { value } });
      fireEvent.blur(total);
    };
    setTotal('120');
    expect(delay()?.value).toBe('30');
    setTotal('40');
    // Off: the field's own value (the default 30 s), to be set.
    fireEvent.click(screen.getByLabelText('Delay follows the total'));
    expect([delay()?.value, delay()?.disabled]).toEqual(['30', false]);
    const join = () => field('Join time');
    expect([join()?.value, join()?.disabled]).toEqual(['20', true]);
    expect(screen.getByText(/Follows the total: half of it/)).toBeTruthy();
    const auto = screen.getByLabelText('Join time follows the total');
    fireEvent.click(auto);
    expect([join()?.value, join()?.disabled]).toEqual(['60', false]);
  });
});
