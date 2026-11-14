// @vitest-environment jsdom
/**
 * @file   apps/admin/src/live/livePage.test.tsx
 * @module admin/live
 * @brief  The live list: a guess round's guess total, none for a phased round.
 *
 * Responsibility: a running guess round shows its guesses; a phased round, which counts none
 *                 (`guesses: null`), shows "—" in that column, never a 0 (DECISIONS T348).
 * Depends on:     vitest, @testing-library/react, ./LivePage
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.2; docs/spec/02e-game-mind-games.md §9
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LivePage } from './LivePage.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const RIGHTS = { abort: false, kick: false, removeResult: false };

const round = (code: string, guesses: number | null) => ({
  roundId: `r-${code}`,
  matchId: `m-${code}`,
  matchCode: code,
  matchTitle: 'Test',
  host: 'dev-host',
  status: 'open',
  season: 'spring',
  secretMode: 'shared',
  halving: false,
  roster: 3,
  connected: 3,
  guesses,
  opensAt: null,
  endsAt: null,
});

describe('the live list (T348)', () => {
  it("shows a guess round's guesses and none for a phased round", async () => {
    const items = [round('GUESS1', 7), round('PHASE1', null)];
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ items }), { status: 200 }))),
    );
    render(<LivePage rights={RIGHTS} />);
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });
    const column = [...screen.getAllByRole('columnheader')].findIndex(
      (h) => h.textContent === 'Guesses',
    );
    const cell = (code: string) =>
      screen.getByTestId(`live-${code}`).querySelectorAll('td')[column]?.textContent;
    expect(cell('GUESS1')).toBe('7');
    expect(cell('PHASE1')).toBe('—');
  });
});
