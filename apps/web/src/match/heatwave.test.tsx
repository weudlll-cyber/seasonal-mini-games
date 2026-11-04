// @vitest-environment jsdom
/**
 * @file   apps/web/src/match/heatwave.test.tsx
 * @module web/match
 * @brief  Heatwave's step and interval in the host's round form (O63).
 *
 * Responsibility: "Heatwave step" and "Heatwave every" show only for a summer round,
 *                 prefilled from the admin's values (1 s, 10 s), limited to 1–10 s and
 *                 5–300 s; the host's values go out with the round and come back in the next
 *                 round's form, like the other round settings.
 * Depends on:     vitest, @testing-library/react, @smg/game-sdk, @smg-game/registry/web,
 *                 ./HostMenu
 * Spec:           docs/spec/03-seasonal-specials.md §2.2; docs/spec/08-admin-settings.md §3
 */
import { GAME_SCREENS } from '@smg-game/registry/web';
import { PLATFORM_ROUND_SETTINGS, type SettingValue } from '@smg/game-sdk';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HostConsole } from './HostMenu.js';

const posted: unknown[] = [];
vi.mock('../shell/http.js', () => ({
  api: (path: string, init?: { body?: unknown }) => {
    if (path === '/seasons/current') return Promise.resolve({ inSeason: null, halvingToday: null });
    posted.push(init?.body);
    return Promise.resolve({});
  },
  ApiError: class extends Error {},
  BASE_PATH: '/',
}));

afterEach(() => {
  cleanup();
  posted.length = 0;
});

const defs = [...PLATFORM_ROUND_SETTINGS, ...(GAME_SCREENS['guess-the-number']?.settings ?? [])];
const match = {
  code: 'ABC123',
  teamMatch: true,
  youHost: true,
  round: null,
  nextRoundDefaults: {
    id: 'game',
    version: 1,
    updatedAt: null,
    defs,
    overrides: {},
    values: {},
    editable: [],
  },
} as never;

async function open(last: Record<string, SettingValue> | null, setLast = vi.fn()) {
  render(
    <HostConsole
      match={match}
      roundStatus={null}
      reload={() => undefined}
      last={last}
      setLast={setLast}
      close={() => undefined}
    />,
  );
  // The season feed answers: no In Season, so Spring by hand.
  await act(async () => {
    await Promise.resolve();
  });
  return setLast;
}

const field = (label: string) => screen.queryByLabelText<HTMLInputElement>(label);
const season = (value: string) => {
  fireEvent.change(screen.getByLabelText('Season'), { target: { value } });
};

describe("Heatwave in the host's round form (O63)", () => {
  it('shows step and interval only for summer, from the admin values, in their bounds', async () => {
    await open(null);
    expect(field('Heatwave step')).toBeNull();
    season('summer');
    expect(field('Heatwave step')?.value).toBe('1');
    expect(field('Heatwave every')?.value).toBe('10');
    expect([field('Heatwave step')?.min, field('Heatwave step')?.max]).toEqual(['1', '10']);
    expect([field('Heatwave every')?.min, field('Heatwave every')?.max]).toEqual(['5', '300']);
    season('autumn');
    expect(field('Heatwave every')).toBeNull();
  });

  it("sends the host's values with the round and keeps them for the next", async () => {
    const setLast = await open(null);
    season('summer');
    fireEvent.change(field('Heatwave step') as HTMLElement, { target: { value: '3' } });
    fireEvent.change(field('Heatwave every') as HTMLElement, { target: { value: '20' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('create-start'));
      await Promise.resolve();
    });
    expect(posted[0]).toMatchObject({
      season: 'summer',
      settings: { 'summer.stepS': 3, 'summer.stepIntervalS': 20 },
    });
    const used = setLast.mock.calls[0]?.[0] as Record<string, SettingValue>;
    expect(used).toMatchObject({ 'summer.stepS': 3, 'summer.stepIntervalS': 20 });
    cleanup();
    await open(used);
    season('summer');
    expect([field('Heatwave step')?.value, field('Heatwave every')?.value]).toEqual(['3', '20']);
  });
});
