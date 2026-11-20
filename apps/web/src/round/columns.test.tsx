// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/columns.test.tsx
 * @module web/round
 * @brief  A list game's guesses in two columns on a desktop (owner decision O109).
 *
 * Responsibility: the stage's list of a list game on a desktop is the two-column list, on a
 *                 phone the one column as before; its rows are newest first, so the newest is at
 *                 the top of the left column and the right column goes on from the foot of the
 *                 left one, in shared mode (every player's rows, the viewer's marked) and in
 *                 individual mode (the viewer's rows only); the columns fill in that order, each
 *                 row whole in one (jsdom has no layout: the rules themselves are checked, as
 *                 ./rows.test does for T150).
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./fakes, ./RoundLog,
 *                 ./RoundScreen, ./roundColumns.css (read as text)
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/09-testing-strategy.md §2
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { RoundStateView } from '@smg/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ended, viewport } from './fakes.js';
import { RoundLog } from './RoundLog.js';
import { RoundScreen } from './RoundScreen.js';

// (The test file's folder as ./rows.test finds it: jsdom's import.meta.url is no file URL.)
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const columnsCss = readFileSync(path.join(HERE, 'roundColumns.css'), 'utf8');

afterEach(() => {
  cleanup();
  viewport(1024, 768);
});

// Six guesses, a second apart, every third the viewer's (playerId null), the rest Walter's.
const ROWS = [1, 2, 3, 4, 5, 6].map((n) => ({
  key: String(n),
  at: n * 1_000,
  playerId: n % 3 === 0 ? null : 'w',
  value: n * 10,
  pending: false,
  tier: null,
  feedback: 'higher' as const,
  comment: `Guess ${String(n)}.`,
}));
const game = { text: { code: () => null, event: () => null, guesses: () => ROWS } } as never;
const open: RoundStateView = { ...ended, status: 'open', role: 'player', game: {} };

// The values of the list's rows, top to bottom in reading order.
const values = () =>
  [...screen.getByTestId('guess-list').querySelectorAll('li .round-value')].map(
    (v) => v.textContent,
  );

function columns(state: RoundStateView): HTMLElement {
  render(
    <RoundLog
      feed={[]}
      game={game}
      state={state}
      viewerKey="a"
      now={7_000}
      kind="main"
      phone={false}
      columns
    />,
  );
  return screen.getByTestId('guess-list');
}

describe('the two columns (O109)', () => {
  it('in shared mode: the newest at the top left, the right column going on from the left', () => {
    const list = columns(open);
    expect(list.getAttribute('data-columns')).toBe('2');
    expect(values()).toEqual(['60', '50', '40', '30', '20', '10']);
    // The viewer's rows keep their mark in the columns.
    const own = [...list.querySelectorAll('li')].filter((r) => r.dataset['own'] === 'true');
    expect(own.map((r) => r.querySelector('.round-value')?.textContent)).toEqual(['60', '30']);
  });

  it('in individual mode: only the viewer’s rows, newest first, the same way', () => {
    const list = columns({ ...open, secretMode: 'individual' });
    expect(list.getAttribute('data-columns')).toBe('2');
    expect(values()).toEqual(['60', '30']);
  });

  it('fills the left column to its foot before the right one, a row whole in one column', () => {
    expect(columnsCss).toContain('column-count: 2;');
    expect(columnsCss).toContain('column-gap: 28px;');
    expect(columnsCss).toContain('column-fill: auto;');
    expect(columnsCss).toContain('break-inside: avoid;');
  });
});

// An open Guess The Number round with Anna's one guess, on the real screen.
const gtn: RoundStateView = {
  ...open,
  game: {
    range: { low: 1, high: 100 },
    removed: [],
    newest: [],
    hint: null,
    guesses: [
      {
        receiveSeq: 1,
        receivedAt: 1_000,
        value: 40,
        feedback: 'lower',
        tier: 'warm',
        comment: 'Close.',
      },
    ],
    log: [],
  },
};

function screenAt(width: number, height: number): HTMLElement {
  viewport(width, height);
  render(
    <RoundScreen
      live={{ state: gtn, feed: [], reload: () => Promise.resolve() }}
      gameId="guess-the-number"
      viewerKey="a"
      host={null}
      teamPoints={[]}
      standings={[]}
      chat={null}
    />,
  );
  return screen.getByTestId('guess-list');
}

describe("a list game's stage", () => {
  it('has the two-column list on a desktop', () => {
    expect(screenAt(1440, 900).getAttribute('data-columns')).toBe('2');
  });

  it('keeps one column on a phone', () => {
    expect(screenAt(390, 844).getAttribute('data-columns')).toBeNull();
  });
});
