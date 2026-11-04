// @vitest-environment jsdom
/**
 * @file   apps/web/src/match/summary.test.tsx
 * @module web/match
 * @brief  The end of a match (O27, O28): End match with its confirm sentence, and the summary.
 *
 * Responsibility: End match first asks with its sentence and closes the match only when
 *                 confirmed, Cancel asks nothing of the server; the summary says how the match
 *                 ended (the host, the idle close with its minutes, an abort with its reason),
 *                 how many rounds were played, every player's points and wins in standings
 *                 order with grouped numbers, the teams over the match (none without teams,
 *                 O34), and links back to Play; the standings and the rest in their own parts
 *                 of a one-screen page.
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./EndMatch, ./MatchSummary
 *                 (with ../shell/http replaced)
 * Spec:           docs/spec/02-game-guess-the-number.md §2
 */
import type { MatchDetailsView } from '@smg/contracts';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EndMatch } from './EndMatch.js';
import { endText, MatchSummary } from './MatchSummary.js';

const calls: string[] = [];
vi.mock('../shell/http.js', () => ({
  api: (path: string) => {
    calls.push(path);
    // The installed games, for the summary's game line (O41).
    const games = [
      { id: 'guess-the-number', name: 'Guess The Number', secretModes: [], teams: true },
    ];
    return Promise.resolve(path === '/games' ? { games } : undefined);
  },
  ApiError: class extends Error {},
  BASE_PATH: '/',
}));

afterEach(() => {
  cleanup();
  calls.length = 0;
});

describe('End match', () => {
  it('asks with its sentence and closes the match only when confirmed', async () => {
    const done = vi.fn();
    render(<EndMatch code="ABC123" done={done} />);
    fireEvent.click(screen.getByTestId('end-match'));
    expect(screen.getByTestId('end-match-confirm').textContent).toBe(
      'End this match for everyone? A running round is aborted.',
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(calls).toEqual([]);
    fireEvent.click(screen.getByTestId('end-match'));
    fireEvent.click(screen.getByTestId('end-match-yes'));
    await waitFor(() => {
      expect(done).toHaveBeenCalled();
    });
    expect(calls).toEqual(['/matches/ABC123/close']);
  });
});

const ended: MatchDetailsView = {
  code: 'ABC123',
  gameId: 'guess-the-number',
  title: 'Friday',
  status: 'closed',
  visibility: 'public',
  maxPlayers: 10,
  countsForLeaderboard: true,
  teamMatch: true,
  createdAt: 0,
  youHost: false,
  youPlayer: true,
  you: 'p2',
  teamLocked: true,
  host: 'Hanna',
  players: [],
  connected: [],
  round: { id: 'r2', status: 'ended' },
  teamStandings: [
    { team: 'summer', points: 2 },
    { team: 'winter', points: 0 },
  ],
  standings: [
    { rank: 1, playerKey: 'a', name: 'Anna', points: 1_250, wins: 2 },
    { rank: 2, playerKey: 'bot-01', name: 'bot-01', points: 0, wins: 0 },
  ],
  nextRoundDefaults: null,
  ended: { roundsPlayed: 2, by: 'host', reason: null, idleMinutes: null },
};

describe('the match summary', () => {
  it('names the match’s game (O41)', async () => {
    render(<MatchSummary match={ended} viewerKey="a" />);
    await waitFor(() => {
      expect(screen.getByTestId('match-game').textContent).toBe('Guess The Number');
    });
  });

  it('names the end, the rounds, the players in standings order, the teams and the way back', () => {
    render(<MatchSummary match={ended} viewerKey="a" />);
    expect(screen.getByTestId('match-end').textContent).toBe('The host ended the match.');
    expect(screen.getByText('2 rounds played.')).toBeTruthy();
    const rows = [...screen.getByTestId('match-standings').querySelectorAll('tbody tr')];
    expect(rows.map((r) => [...r.children].map((c) => c.textContent))).toEqual([
      ['1', 'Anna (you)', '1,250', '2'],
      ['2', 'bot-01', '0', '0'],
    ]);
    expect(screen.getByTestId('match-teams').textContent).toBe(
      ' Team Summer: 2 points Team Winter: 0 points',
    );
    expect(screen.getByRole('link', { name: 'Back to Play' }).getAttribute('href')).toBe('#/');
    // One screen: the standings in their own column, the rest beside them (./summary.css).
    const summary = screen.getByTestId('match-summary');
    expect(summary.closest('.one-screen')).not.toBeNull();
    const standings = summary.querySelector('.match-summary-standings');
    const side = summary.querySelector('.match-summary-side');
    expect(standings?.contains(screen.getByTestId('match-standings'))).toBe(true);
    expect(side?.contains(screen.getByTestId('match-teams'))).toBe(true);
    expect(side?.textContent).toContain('2 rounds played.');
  });

  it('leaves the team standing out of a match without teams (O34)', () => {
    render(<MatchSummary match={{ ...ended, teamMatch: false }} viewerKey="a" />);
    expect(screen.queryByTestId('match-teams')).toBeNull();
    expect(screen.getByTestId('match-summary').textContent).not.toMatch(/team/i);
  });

  it('says why it ended: the idle close with its minutes, or an abort with its reason', () => {
    const end = ended.ended;
    if (end === null) throw new Error('fixture');
    expect(endText('closed', { ...end, by: 'system', reason: 'idle', idleMinutes: 60 })).toBe(
      'The match closed after 60 minutes without a round.',
    );
    expect(endText('aborted', { ...end, reason: 'lights out' })).toBe(
      'The match was aborted: lights out.',
    );
  });
});
