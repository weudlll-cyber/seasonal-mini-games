// @vitest-environment jsdom
/**
 * @file   apps/admin/src/live/roundPanel.test.tsx
 * @module admin/live
 * @brief  The staff's round panel: a guess round's columns, a phased round's without counts.
 *
 * Responsibility: a guess round's players keep Player, Guesses, Place, Points and Action; a
 *                 phased round's show Player, Points and Action only, so no count of a
 *                 player's choices (which would show their switches) and no place reach the
 *                 admin screen (02e §9, DECISIONS T343).
 * Depends on:     vitest, @testing-library/react, ./RoundPanel
 * Spec:           docs/spec/06-data-model-api-realtime.md §3.2; docs/spec/02e-game-mind-games.md §9
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RoundPanel } from './RoundPanel.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const RIGHTS = { abort: false, kick: false, removeResult: false };

// The staff view of an ended round of two players; `plan` makes it a phased one.
const view = (plan?: object) => ({
  roundId: 'r1',
  status: 'ended',
  abortReason: null,
  roster: [
    { playerKey: 'p1', guesses: 4, place: null },
    { playerKey: 'p2', guesses: 3, place: null },
  ],
  results: [
    { playerId: 'p1', place: null, points: 1 },
    { playerId: 'p2', place: null, points: 0 },
  ],
  names: { p1: 'Anna', p2: 'Bo' },
  match: { id: 'm1', code: 'ABC123', title: 'Test' },
  players: ['p1', 'p2'],
  removed: [],
  ...(plan === undefined ? {} : { plan }),
});

async function shown(body: object): Promise<string[][]> {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))),
  );
  render(<RoundPanel roundId="r1" rights={RIGHTS} close={() => undefined} />);
  await act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
  return screen
    .getAllByRole('row')
    .map((r) => [...r.querySelectorAll('th, td')].map((c) => c.textContent));
}

describe('the staff round panel (T343)', () => {
  it('keeps a guess round’s columns', async () => {
    const rows = await shown(view());
    expect(rows[0]).toEqual(['Player', 'Guesses', 'Place', 'Points', 'Action']);
    expect(rows[1]).toEqual(['Anna', '4', '—', '1', '']);
  });

  it('shows a phased round’s players with their points only', async () => {
    const rows = await shown(view({ entryEndMs: 1, actionsEndMs: 2, endMs: 3, viewDelayMs: 1 }));
    expect(rows).toEqual([
      ['Player', 'Points', 'Action'],
      ['Anna', '1', ''],
      ['Bo', '0', ''],
    ]);
  });
});
