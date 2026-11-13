// @vitest-environment jsdom
/**
 * @file   apps/web/src/match/prefs.test.tsx
 * @module web/match
 * @brief  A phased game's pre-pick panel in the waiting area (04 §4.8 rule 8).
 *
 * Responsibility: the game's `Prefs` panel shows for a player of the match with the viewer's
 *                 own value, the series' rounds and those played; what it saves is sent with
 *                 `PUT …/prefs`, and a refusal's code comes back to it; a spectator and a game
 *                 without the panel get nothing.
 * Depends on:     vitest, @testing-library/react, ./GamePrefs
 * Spec:           docs/spec/04-software-architecture.md §4.8 rule 8; docs/spec/06-data-model-api-realtime.md §3.1
 */
import type { MatchDetailsView } from '@smg/contracts';
import type { PrefsPanelProps } from '@smg/game-sdk';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const sent: { path: string; body: unknown }[] = [];
let refuse = false;
vi.mock('../shell/http.js', () => {
  class ApiError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  return {
    ApiError,
    api: (path: string, init: { body: unknown }) => {
      sent.push({ path, body: init.body });
      return refuse ? Promise.reject(new ApiError('PREFS_INVALID')) : Promise.resolve(null);
    },
  };
});

// A stand-in game panel: it shows what it got and saves one value.
function StubPanel(p: PrefsPanelProps) {
  const [answer, setAnswer] = useState('');
  return (
    <div data-testid="stub-prefs">
      {JSON.stringify({ prefs: p.prefs, rounds: p.rounds, played: p.played })}
      <button
        type="button"
        onClick={() => {
          void p.save({ picks: { '1': 'a' } }).then((r) => {
            setAnswer(r.ok ? 'saved' : (r.code ?? ''));
          });
        }}
      >
        Save
      </button>
      <span data-testid="stub-answer">{answer}</span>
    </div>
  );
}
vi.mock('@smg-game/registry/web', () => ({
  GAME_SCREENS: { 'sides-fixture': { Prefs: StubPanel } },
}));

const { GamePrefs } = await import('./GamePrefs.js');

afterEach(() => {
  cleanup();
  sent.length = 0;
  refuse = false;
});

const match = (change: Partial<MatchDetailsView>): MatchDetailsView =>
  ({
    code: 'ABC123',
    gameId: 'sides-fixture',
    youPlayer: true,
    myPrefs: { picks: { '2': 'b' } },
    series: { rounds: 2, played: 1, nextAt: null },
    ...change,
  }) as MatchDetailsView;

describe('the pre-pick panel (04 §4.8 rule 8)', () => {
  it('gets the viewer’s own value and the series, and saves through PUT …/prefs', async () => {
    render(<GamePrefs match={match({})} />);
    expect(screen.getByTestId('stub-prefs').textContent).toContain(
      '{"prefs":{"picks":{"2":"b"}},"rounds":2,"played":1}',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('saved')).toBeTruthy();
    expect(sent).toEqual([
      { path: '/matches/ABC123/prefs', body: { prefs: { picks: { '1': 'a' } } } },
    ]);
  });

  it('hands a refusal’s code back to the panel', async () => {
    refuse = true;
    render(<GamePrefs match={match({})} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('PREFS_INVALID')).toBeTruthy();
  });

  it('shows nothing to a spectator or for a game without the panel', () => {
    render(<GamePrefs match={match({ youPlayer: false })} />);
    expect(screen.queryByTestId('stub-prefs')).toBeNull();
    render(<GamePrefs match={match({ gameId: 'guess-the-number' })} />);
    expect(screen.queryByTestId('stub-prefs')).toBeNull();
  });
});
