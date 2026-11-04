// @vitest-environment jsdom
/**
 * @file   apps/web/src/shell/quickTest.test.tsx
 * @module web/shell
 * @brief  Heatwave's step and interval in the Quick Test form, which sets up the first round (O63).
 *
 * Responsibility: the form shows "Heatwave step" and "Heatwave every" only with summer chosen,
 *                 from the definitions' defaults and bounds (the host form's own fields), and
 *                 the request body carries both for a summer round and neither otherwise.
 * Depends on:     vitest, @testing-library/react, ./QuickTest, ./quickTestSettings
 * Spec:           docs/spec/03-seasonal-specials.md §2.2; docs/spec/11-roadmap.md (Quick Test)
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QuickTest } from './QuickTest.js';
import { bodyOf, START, type Extra } from './quickTestSettings.js';

vi.mock('./http.js', () => ({
  api: () => Promise.resolve({ games: [] }),
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
