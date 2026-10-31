// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/result.test.tsx
 * @module web/round
 * @brief  The result screen: headline, margin or closest miss, placings, teams and the proof.
 *
 * Responsibility: the result gives the headline, the winning margin, placings with "took
 *                 part", the team result and the fairness proof; without a margin the game's
 *                 closest miss stands in its place, and nothing when there is none (O22).
 * Depends on:     vitest, @testing-library/react, @smg-game/registry/web, ./fakes,
 *                 ./ResultScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §9; docs/spec/09-testing-strategy.md §2
 */
import { GAME_SCREENS } from '@smg-game/registry/web';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ended } from './fakes.js';
import { ResultScreen } from './ResultScreen.js';

afterEach(() => {
  cleanup();
});

describe('the result screen', () => {
  it('gives the headline, the margin, placings, the team result and the proof', () => {
    render(<ResultScreen state={ended} game={null} viewerKey="a" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Walter found it first — after 9 guesses.',
    );
    expect(screen.getByTestId('margin').textContent).toBe('Found it 0.4 s before Anna.');
    const rows = [...screen.getByTestId('placings').querySelectorAll('tbody tr')].map(
      (tr) => tr.textContent,
    );
    expect(rows).toEqual(['1 Walter910', 'took part Anna (you)40']);
    expect(screen.getByTestId('team-result').textContent).toContain(
      'Autumn: 1 point — the winner’s team',
    );
    expect(screen.getByTestId('proof').textContent).toContain('cd'.repeat(32));
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
    render(<ResultScreen state={state} game={game} viewerKey="a" />);
    expect(screen.queryByTestId('margin')).toBeNull();
    expect(screen.getByTestId('closest-miss').textContent).toBe('Anna missed by just 1 (93).');
    cleanup();
    const far = { ...view, closestMiss: { playerId: 'a', value: 60, distance: 32 } };
    render(<ResultScreen state={{ ...state, game: far }} game={game} viewerKey="a" />);
    expect(screen.getByTestId('closest-miss').textContent).toBe(
      'Closest miss: Anna, 32 away (60).',
    );
    cleanup();
    // With a margin, the margin stays and the closest miss is not shown (O13).
    render(<ResultScreen state={{ ...ended, game: view }} game={game} viewerKey="a" />);
    expect(screen.getByTestId('margin')).toBeTruthy();
    expect(screen.queryByTestId('closest-miss')).toBeNull();
    cleanup();
    const none = { ...state, game: { ...view, closestMiss: null } };
    render(<ResultScreen state={none} game={game} viewerKey="a" />);
    expect(screen.queryByTestId('closest-miss')).toBeNull();
  });
});
