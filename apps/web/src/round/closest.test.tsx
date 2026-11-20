// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/closest.test.tsx
 * @module web/round
 * @brief  The result's "Closest to winning" (O110), "All guesses" and the compact first part.
 *
 * Responsibility: the rows in the server's order, each with rank, name, guess and the game's
 *                 words (Guess The Number "off by 1", Safecracker its counts, Bomb Defusal its
 *                 dots and correct start), a solve marked and worded as the game's own; "All
 *                 guesses (N)" with every guess counted opens every player's guesses in full in
 *                 place of the rows and closes again; the team line in the placings' foot; a
 *                 game without best guesses (Seasonal Target) keeps every guess in full below
 *                 its first part; the rows' CSS: two columns of five on a desktop, filled down.
 * Depends on:     vitest, @testing-library/react, node:fs, node:path, @smg-game/registry/web, ./fakes,
 *                 ./ResultScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §9
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { GAME_SCREENS } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ended } from './fakes.js';
import { ResultScreen } from './ResultScreen.js';

afterEach(() => {
  cleanup();
});

// The test file's folder (jsdom's import.meta.url is no file URL, as ./columns.test finds it).
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const show = (gameId: string, state: RoundStateView) => {
  render(
    <ResultScreen state={state} game={GAME_SCREENS[gameId] ?? null} viewerKey="a" standings={[]} />,
  );
};

const rows = () =>
  [...screen.getByTestId('closest').querySelectorAll('li')].map((li) =>
    [...li.children]
      .map((part) => part.textContent)
      .filter((t) => t !== '')
      .join(' '),
  );

const gtnView = {
  range: { low: 1, high: 100 },
  secret: 92,
  secrets: null,
  guesses: {
    w: [
      { value: 50, feedback: 'higher' },
      { value: 92, feedback: 'correct' },
    ],
    a: [{ value: 93, feedback: 'lower' }],
  },
  closestMiss: { playerId: 'a', value: 93, distance: 1 },
};
const gtnRows = [
  { playerId: 'w', index: 1, distance: 0 },
  { playerId: 'a', index: 0, distance: 1 },
];

describe('closest to winning', () => {
  it('lists the server’s rows in the game’s words, the solve marked as found', () => {
    show('guess-the-number', { ...ended, game: gtnView, closest: gtnRows });
    expect(rows()).toEqual(['1 Walter 92 found it', '2 Anna 93 off by 1']);
    const [first, second] = screen.getByTestId('closest').querySelectorAll('li');
    expect(first?.hasAttribute('data-found')).toBe(true);
    expect(second?.hasAttribute('data-found')).toBe(false);
    expect(second?.querySelector('.round-who')?.getAttribute('title')).toBe('Anna');
    // Every guess is not on the page until it is asked for.
    expect(screen.queryByTestId('result-history')).toBeNull();
  });

  it('opens every guess in full behind "All guesses (N)" and closes it again', () => {
    show('guess-the-number', { ...ended, game: gtnView, closest: gtnRows });
    // 9 + 4 guesses in the round's results.
    const button = screen.getByTestId('all-guesses');
    expect(button.textContent).toBe('All guesses (13)');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.textContent).toBe('Closest only');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const all = screen.getByTestId('result-history');
    expect(within(all).getByRole('list', { name: 'Every guess' }).textContent).toContain(
      '50 higher, 92 correct',
    );
    expect(screen.queryByTestId('closest')).toBeNull();
    fireEvent.click(button);
    expect(screen.queryByTestId('result-history')).toBeNull();
    expect(rows()).toHaveLength(2);
  });

  it('puts the team line in the placings’ foot, after "All placings"', () => {
    show('guess-the-number', { ...ended, game: gtnView, closest: gtnRows });
    const foot = screen
      .getByTestId('placings')
      .closest('.round-placings')
      ?.querySelector('.round-placings-foot');
    expect(foot?.querySelector('[data-testid="team-line"]')).not.toBeNull();
    expect(screen.getByTestId('result').hasAttribute('data-closest')).toBe(true);
  });

  it('keeps every guess in full below the first part for a game without best guesses', () => {
    const target = GAME_SCREENS['seasonal-target'];
    expect(target?.text.best).toBeUndefined();
    show('guess-the-number', { ...ended, game: gtnView });
    // No rows from the server: the full history stays, without "All guesses".
    expect(screen.getByTestId('result-history').textContent).toContain('92 correct');
    expect(screen.queryByTestId('all-guesses')).toBeNull();
    expect(screen.getByTestId('result').hasAttribute('data-closest')).toBe(false);
  });
});

describe('closest to winning in the other games and its layout', () => {
  it('words Safecracker’s and Bomb Defusal’s rows as the games do', () => {
    const sc = {
      length: 4,
      digits: 10,
      secret: '1234',
      secrets: null,
      guesses: {
        w: [{ value: '1234', feedback: { exact: 4, near: 0, solved: true } }],
        a: [{ value: '1243', feedback: { exact: 2, near: 2, solved: false } }],
      },
      closestMiss: null,
    };
    show('safecracker', { ...ended, game: sc, closest: gtnRows.map((r) => ({ ...r, index: 0 })) });
    expect(rows()).toEqual(['1 Walter 1234 cracked it', '2 Anna 1243 2 right · 2 wrong places']);
    cleanup();
    const bd = {
      wires: ['red', 'blue', 'yellow', 'white'],
      cuts: 3,
      secret: ['red', 'blue', 'yellow'],
      secrets: null,
      guesses: {
        w: [{ value: ['red', 'blue', 'yellow'], feedback: { correct: 3, defused: true } }],
        a: [{ value: ['red', 'white', 'blue'], feedback: { correct: 1, defused: false } }],
      },
      closestMiss: null,
    };
    show('bomb-defusal', { ...ended, game: bd, closest: gtnRows.map((r) => ({ ...r, index: 0 })) });
    expect(rows()).toEqual(['1 Walter defused it', '2 Anna first cut right']);
    const dots = screen
      .getByTestId('closest')
      .querySelectorAll('li')[1]
      ?.querySelectorAll('.round-swatch');
    expect([...(dots ?? [])].map((d) => d.getAttribute('aria-label'))).toEqual([
      'red',
      'white',
      'blue',
    ]);
  });

  it('fills two columns of five on a desktop, down the left one first (the CSS)', () => {
    const css = readFileSync(path.join(HERE, 'closest.css'), 'utf8');
    const desktop = css.slice(css.indexOf('@media (min-width: 900px)'));
    expect(desktop).toMatch(/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(desktop).toMatch(/grid-template-rows: repeat\(5, auto\)/);
    expect(desktop).toMatch(/grid-auto-flow: column/);
  });
});
