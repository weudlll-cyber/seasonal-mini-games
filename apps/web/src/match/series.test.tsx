// @vitest-environment jsdom
/**
 * @file   apps/web/src/match/series.test.tsx
 * @module web/match
 * @brief  A series on the match page: the round count and pause, and the host form's request.
 *
 * Responsibility: 04 §4.8 rule 7 in the client. The waiting area's series line names the
 *                 round of the series and counts the pause down from the server's time; only
 *                 the host gets Start next round now, with its tooltip, and it posts the start;
 *                 a match that is no series shows nothing. The host form's request carries
 *                 `round.halving` only where the document has it, creates a round outside a
 *                 pause and keeps the next round's settings during one.
 * Depends on:     vitest, @testing-library/react, ./SeriesStatus, ./roundRequest
 * Spec:           docs/spec/04-software-architecture.md §4.8 rule 7; docs/spec/06-data-model-api-realtime.md §3.1
 */
import type { MatchDetailsView } from '@smg/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const posted: string[] = [];
vi.mock('../shell/http.js', () => ({
  api: (path: string) => {
    posted.push(path);
    return Promise.resolve(null);
  },
}));
vi.mock('../live/socket.js', () => ({ serverNow: () => 100_000 }));

const { SeriesStatus } = await import('./SeriesStatus.js');
const { roundRequest } = await import('./roundRequest.js');

afterEach(() => {
  cleanup();
  posted.length = 0;
});

const match = (change: Partial<MatchDetailsView>): MatchDetailsView =>
  ({
    code: 'ABC123',
    gameId: 'sides-fixture',
    youHost: false,
    series: { rounds: 6, played: 3, nextAt: 112_000 },
    ...change,
  }) as MatchDetailsView;

describe('a series on the match page (04 §4.8 rule 7)', () => {
  it('names the round and counts the pause down, for everyone', () => {
    render(<SeriesStatus match={match({})} />);
    expect(screen.getByTestId('series-status').textContent).toBe(
      'Round 3 of 6 · Next round in 12 s',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('gives the host Start next round now, which asks the server to start it', () => {
    render(<SeriesStatus match={match({ youHost: true })} />);
    const button = screen.getByRole('button', { name: 'Start next round now' });
    expect(button.getAttribute('title')).toMatch(/starts the next round now/);
    fireEvent.click(button);
    expect(posted).toEqual(['/matches/ABC123/next-round/start']);
  });

  it('says when the match ends after its last round, and nothing for a match that is no series', () => {
    render(<SeriesStatus match={match({ series: { rounds: 6, played: 6, nextAt: 105_000 } })} />);
    expect(screen.getByTestId('series-status').textContent).toBe(
      'Round 6 of 6 · The match ends in 5 s',
    );
    cleanup();
    render(<SeriesStatus match={match({ series: null })} />);
    expect(screen.queryByTestId('series-status')).toBeNull();
  });
});

describe('the host form’s request', () => {
  const form = {
    keys: ['round.countdownS'],
    values: { 'round.countdownS': 5 },
    halving: false,
    season: 'summer',
  };

  it('keeps the next round’s settings during a pause, without halving where the game has none', () => {
    expect(roundRequest(match({}), form, true)).toEqual({
      path: '/matches/ABC123/next-round',
      method: 'PUT',
      body: { settings: { 'round.countdownS': 5 }, season: 'summer' },
    });
  });

  it('creates the round outside a pause, with halving where the document has it', () => {
    const keys = ['round.countdownS', 'round.halving'];
    expect(
      roundRequest(match({ series: null }), { ...form, keys, season: 'inSeason' }, true),
    ).toEqual({
      path: '/matches/ABC123/rounds',
      method: 'POST',
      body: { settings: { 'round.countdownS': 5, 'round.halving': false }, startNow: true },
    });
  });
});
