// @vitest-environment jsdom
/**
 * @file   apps/web/src/match/inactivityForms.test.tsx
 * @module web/match
 * @brief  The inactivity pair in every round setup (O75) and refused settings under their
 *         field (O74).
 *
 * Responsibility: the host form shows the server's sentence for a refused setting under the
 *                 field it names ("The warning must be shorter than the limit." under the
 *                 warning), a refusal without a field as the form's line; the next round's
 *                 form starts from the last round's limit and warning (`keptOf`, like the kept
 *                 season, T209); the Quick Test offers both fields, sends them by key, and
 *                 shows its refusal under the field too.
 * Depends on:     vitest, @testing-library/react, @smg/game-sdk, @smg-game/registry/web,
 *                 ./HostMenu, ./roundFields, ../round/fakes, ../shell/QuickTest,
 *                 ../shell/quickTestSettings
 * Spec:           docs/spec/02-game-guess-the-number.md §3, §5.3, §12; docs/spec/08-admin-settings.md §3
 */
import { GAME_SCREENS } from '@smg-game/registry/web';
import { PLATFORM_ROUND_SETTINGS, type SettingValue } from '@smg/game-sdk';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ended } from '../round/fakes.js';
import { QuickTest } from '../shell/QuickTest.js';
import { bodyOf, START, type Extra } from '../shell/quickTestSettings.js';
import { HostConsole } from './HostMenu.js';
import { keptOf } from './roundFields.js';

// The server's answer to the next POST: a refused setting, or a refusal without a field.
const answer = vi.hoisted(() => ({ refusal: null as { field: string; detail: string } | null }));
vi.mock('../shell/http.js', () => {
  class ApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      readonly reason: string | null = null,
      readonly refusal: { field: string; detail: string } | null = null,
    ) {
      super(code);
    }
  }
  return {
    api: (path: string) => {
      if (path === '/seasons/current')
        return Promise.resolve({ inSeason: null, halvingToday: null });
      if (path === '/games') return Promise.resolve({ games: [] });
      return Promise.reject(new ApiError(422, 'ROUND_SETTINGS_INVALID', null, answer.refusal));
    },
    ApiError,
    BASE_PATH: '/',
  };
});

afterEach(() => {
  cleanup();
  answer.refusal = null;
});

const PAIR = 'The warning must be shorter than the limit.';
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

async function hostForm(last: Record<string, SettingValue> | null) {
  render(
    <HostConsole
      match={match}
      roundStatus={null}
      reload={() => undefined}
      last={last}
      setLast={() => undefined}
      close={() => undefined}
    />,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

const field = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
// The problem line under a field: the one its control names in aria-describedby.
const problemUnder = (label: string) => {
  const ids = field(label).getAttribute('aria-describedby')?.split(' ') ?? [];
  const lines = ids.map((id) => document.getElementById(id));
  return lines.find((l) => l?.dataset.testid === 'field-problem')?.textContent ?? null;
};

async function submit(testId: string) {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId));
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('a refused setting in the host form (O74)', () => {
  it("shows the server's sentence under the field it names, announced", async () => {
    answer.refusal = { field: 'round.inactivityWarnS', detail: PAIR };
    await hostForm(null);
    await submit('create-start');
    expect(problemUnder('Inactivity warning')).toBe(PAIR);
    expect(screen.getByText(PAIR).getAttribute('role')).toBe('alert');
    expect(problemUnder('Inactivity limit')).toBeNull();
    // A change in the form clears it until the next answer.
    fireEvent.change(field('Inactivity warning'), { target: { value: '20' } });
    expect(problemUnder('Inactivity warning')).toBeNull();
  });

  it('shows a refusal without a field as the form line', async () => {
    await hostForm(null);
    await submit('create-start');
    expect(screen.getByRole('alert').textContent).toBe('These round settings are not allowed.');
  });
});

describe("the next round's form keeps the inactivity pair (O75)", () => {
  it("starts from the last round's limit and warning, like the kept season", async () => {
    const view = { ...ended, inactivityLimitMs: 45_000, inactivityWarnMs: 15_000 };
    await hostForm(keptOf(view));
    expect(field('Inactivity limit').value).toBe('45');
    expect(field('Inactivity warning').value).toBe('15');
    // A round made before O71 has no warning: the document's values stay.
    expect(keptOf({ ...view, inactivityLimitMs: 0, inactivityWarnMs: 0 })).not.toHaveProperty(
      'round.inactivityWarnS',
    );
  });
});

describe('the inactivity pair in the Quick Test (O75)', () => {
  const extra: Extra = {
    gameId: 'guess-the-number',
    seedText: '',
    season: '',
    bots: 3,
    fast: true,
    lobby: true,
    teamMatch: true,
  };

  it('offers both fields from their defaults and sends them by key', () => {
    render(<QuickTest />);
    expect(field('Inactivity limit').value).toBe('60');
    expect(field('Inactivity warning').value).toBe('30');
    const values = { ...START, 'round.inactivityLimitS': 0, 'round.inactivityWarnS': 30 };
    expect(bodyOf(values, extra).settings).toMatchObject({
      'round.inactivityLimitS': 0,
      'round.inactivityWarnS': 30,
    });
    expect(bodyOf(START, extra).settings).toMatchObject({
      'round.inactivityLimitS': 60,
      'round.inactivityWarnS': 30,
    });
  });

  it("shows a refused pair's sentence under the warning (O74)", async () => {
    answer.refusal = { field: 'round.inactivityWarnS', detail: PAIR };
    render(<QuickTest />);
    await submit('start-quick-test');
    expect(problemUnder('Inactivity warning')).toBe(PAIR);
  });
});
