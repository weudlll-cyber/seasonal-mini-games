// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/result.test.tsx
 * @module web/round
 * @brief  The result screen: headline, margin or closest miss, placings, teams and the proof.
 *
 * Responsibility: the result gives the headline, the winning margin, placings with "took
 *                 part", the team result, the match standings (./MatchStandings) and the
 *                 fairness proof with the link to the verification page; without a margin the game's
 *                 closest miss stands in its place, and nothing when there is none (O22).
 * Depends on:     vitest, @testing-library/react, @smg-game/registry/web, ./fakes,
 *                 ./ResultScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/09-testing-strategy.md §2
 */
import { GAME_SCREENS } from '@smg-game/registry/web';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ended } from './fakes.js';
import { ResultScreen } from './ResultScreen.js';

afterEach(() => {
  cleanup();
});

describe('the result screen', () => {
  it('gives the headline, the margin, placings, the team result, the standings and the proof', () => {
    const standings = [
      { rank: 1, playerKey: 'w', name: 'Walter', points: 20, wins: 2 },
      { rank: 2, playerKey: 'a', name: 'Anna', points: 7, wins: 0 },
    ];
    render(<ResultScreen state={ended} game={null} viewerKey="a" standings={standings} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Walter found it first — after 9 guesses.',
    );
    expect(screen.getByTestId('margin').textContent).toBe('Found it 0.4 s before Anna.');
    const rows = [...screen.getByTestId('placings').querySelectorAll('tbody tr')].map(
      (tr) => tr.textContent,
    );
    expect(rows).toEqual(['1 Walter910', '– Anna (you)40']);
    // "–" is "took part" for a screen reader; "Pts" on a phone is "Points" (T211).
    expect(screen.getByLabelText('took part').textContent).toBe('–');
    const points = within(screen.getByTestId('placings')).getByRole('columnheader', {
      name: 'Points',
    });
    expect(points.querySelector('.round-long')?.textContent).toBe('Points');
    expect(points.querySelector('.round-short')?.getAttribute('aria-hidden')).toBe('true');
    expect(points.querySelector('.round-short')?.textContent).toBe('Pts');
    expect(screen.getByTestId('team-result').textContent).toContain(
      'Autumn: 1 team point — the winner’s team',
    );
    expect(screen.getByTestId('proof').textContent).toContain('cd'.repeat(32));
    expect(screen.getByRole('link', { name: 'Verify this round' }).getAttribute('href')).toBe(
      '#/rounds/r1/verify',
    );
    const standing = screen.getByTestId('match-standings');
    const standingRows = [...standing.querySelectorAll('tbody tr')].map((tr) => tr.textContent);
    expect(standingRows).toEqual(['1Walter202', '2Anna (you)70']);
    expect(standing.querySelector('.round-you')?.textContent).toBe('2Anna (you)70');
  });
});

describe('the result without a margin', () => {
  it('gives the game’s closest miss in its place, and nothing when there is none (O22)', () => {
    const game = GAME_SCREENS['guess-the-number'] ?? null;
    const view = {
      range: { low: 1, high: 100 },
      secret: 92,
      secrets: null,
      guesses: { w: [{ value: 92, feedback: 'correct' }], a: [{ value: 93, feedback: 'lower' }] },
      closestMiss: { playerId: 'a', value: 93, distance: 1 },
    };
    const state = { ...ended, margin: null, game: view };
    render(<ResultScreen state={state} game={game} viewerKey="a" standings={[]} />);
    expect(screen.queryByTestId('margin')).toBeNull();
    expect(screen.getByTestId('closest-miss').textContent).toBe(
      'Closest miss besides the winner: Anna, missed by just 1 (93).',
    );
    cleanup();
    const far = { ...view, closestMiss: { playerId: 'a', value: 60, distance: 32 } };
    render(
      <ResultScreen state={{ ...state, game: far }} game={game} viewerKey="a" standings={[]} />,
    );
    expect(screen.getByTestId('closest-miss').textContent).toBe(
      'Closest miss besides the winner: Anna, 32 away (60).',
    );
    cleanup();
    // With a margin, the margin stays and the closest miss is not shown (O13).
    render(
      <ResultScreen state={{ ...ended, game: view }} game={game} viewerKey="a" standings={[]} />,
    );
    expect(screen.getByTestId('margin')).toBeTruthy();
    expect(screen.queryByTestId('closest-miss')).toBeNull();
    cleanup();
    const none = { ...state, game: { ...view, closestMiss: null } };
    render(<ResultScreen state={none} game={game} viewerKey="a" standings={[]} />);
    expect(screen.queryByTestId('closest-miss')).toBeNull();
  });
});
