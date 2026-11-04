// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/log.test.tsx
 * @module web/round
 * @brief  The round's lists (T142): main, "Your guesses", All; one-line rows and comments.
 *
 * Responsibility: the main list holds this round's guesses only, under a head with their
 *                 count and "Log (M)" counting guesses and events (T150); in individual mode
 *                 the others' guesses get no rows and a row of their own counts them ("Others:
 *                 Walter: 9 guesses"); "Your guesses" holds the viewer's own only; the banner takes the head's place
 *                 on one line while its event stays in the All list; a desktop row carries its
 *                 comment on its line with the whole text as tooltip, a phone shows the newest
 *                 row's comment and a tap toggles a row's own; a guess's colour dots carry
 *                 their names (T143).
 * Depends on:     vitest, @testing-library/react, @smg/contracts, ./fakes, ./RoundLog
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/09-testing-strategy.md §2
 */
import type { RoundStateView } from '@smg/contracts';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ended } from './fakes.js';
import { othersLine, RoundLog, type LogProps } from './RoundLog.js';

afterEach(() => {
  cleanup();
});

const row = { pending: false, tier: null, feedback: null, value: null };
// Anna's two guesses (own rows come without a player) and one of Walter's, newest last.
const rows = [
  { ...row, key: '1', at: 1_000, playerId: null, value: 10, comment: 'Cold. Try far away.' },
  { ...row, key: '2', at: 2_000, playerId: 'w', value: 50, comment: null },
  { ...row, key: '3', at: 3_000, playerId: null, value: 30, comment: 'Warmer now.' },
];
const game = {
  text: {
    code: () => null,
    event: () => ({ text: 'Leaf Fall: 12 fell.', playerId: null, special: true }),
    guesses: () => rows,
  },
} as never;
const open: RoundStateView = { ...ended, status: 'open', role: 'player', game: {} };
const feed = [{ key: '9', s: 9, at: 2_500, event: { type: 'Game', event: {} } }];

function show(p: Partial<LogProps> = {}) {
  render(
    <RoundLog
      feed={feed}
      game={game}
      state={open}
      viewerKey="a"
      now={4_000}
      kind="main"
      phone={false}
      {...p}
    />,
  );
}

const values = (id: string) =>
  [...screen.getByTestId(id).querySelectorAll('.round-value')].map((v) => v.textContent);

describe('the main list', () => {
  it('holds the guesses only; "Log (M)" counts guesses and events and opens the panel', () => {
    const toggle = vi.fn();
    show({ more: { open: false, toggle, button: () => undefined } });
    expect(values('guess-list')).toEqual(['30', '50', '10']);
    expect(screen.getByTestId('guess-list').textContent).not.toContain('Leaf Fall');
    expect(screen.getByTestId('list-title').textContent).toBe('3 guesses');
    fireEvent.click(screen.getByTestId('list-all'));
    expect(screen.getByTestId('list-all').textContent).toBe('Log (4)');
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('in individual mode leaves the others out and counts them in a row of their own', () => {
    show({ state: { ...open, secretMode: 'individual' } });
    expect(values('guess-list')).toEqual(['30', '10']);
    expect(screen.getByTestId('list-title').textContent).toBe('2 guesses');
    expect(screen.getByTestId('others-line').textContent).toBe('Others: Walter: 9 guesses');
  });

  it('gives the banner the head’s place on one line; its event stays in the All list', () => {
    show({ banner: 'Leaf Fall: 12 numbers fell.' });
    const banner = screen.getByTestId('special-banner');
    expect(banner.textContent).toBe('Leaf Fall: 12 numbers fell.');
    expect(banner.getAttribute('title')).toBe('Leaf Fall: 12 numbers fell.');
    expect(screen.queryByTestId('list-title')).toBeNull();
    cleanup();
    show({ kind: 'all' });
    expect(screen.getByTestId('all-list').textContent).toContain('Leaf Fall: 12 fell.');
  });
});

describe('the individual-mode summary line', () => {
  it('reads "Others: bot-01: 8 guesses · bot-02: 5" without the viewer', () => {
    const roster = [
      { playerKey: 'me', team: null, guesses: 3, cooldownEndsAt: 0, place: null, solved: false },
      { playerKey: 'b1', team: null, guesses: 8, cooldownEndsAt: 0, place: null, solved: false },
      { playerKey: 'b2', team: null, guesses: 5, cooldownEndsAt: 0, place: null, solved: false },
    ];
    const state = { ...open, roster, names: { me: 'Me', b1: 'bot-01', b2: 'bot-02' } };
    expect(othersLine(state, 'me')).toBe('Others: bot-01: 8 guesses · bot-02: 5');
    expect(othersLine({ ...state, roster: roster.slice(0, 1) }, 'me')).toBeNull();
  });
});

describe('"Your guesses"', () => {
  it('holds only the viewer’s guesses of this round, newest first', () => {
    show({ kind: 'own' });
    expect(values('own-list')).toEqual(['30', '10']);
    expect(screen.getByTestId('list-title').textContent).toBe('Your guesses');
    expect(screen.queryByTestId('list-all')).toBeNull();
  });
});

describe('one-line rows', () => {
  it('keep a desktop comment on the row’s line with the whole text as its tooltip', () => {
    show();
    const first = screen.getByTestId('guess-list').querySelector('li');
    const line = first?.querySelector('.round-row-line');
    expect(line?.querySelector('.round-comment')?.getAttribute('title')).toBe('Warmer now.');
    expect(line?.tagName).toBe('SPAN');
  });

  it('on a phone show the newest comment under its row, a tap toggling a row’s own', () => {
    show({ phone: true });
    const list = screen.getByTestId('guess-list');
    const [newest, , older] = [...list.querySelectorAll('li')];
    expect(newest?.querySelector(':scope > .round-comment')?.textContent).toBe('Warmer now.');
    expect(older?.querySelector('.round-comment')).toBeNull();
    const toggle = within(older as HTMLElement).getByRole('button');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(older?.querySelector('.round-comment')?.textContent).toBe('Cold. Try far away.');
    fireEvent.click(within(newest as HTMLElement).getByRole('button'));
    expect(newest?.querySelector('.round-comment')).toBeNull();
  });
});

describe('colour dots', () => {
  it('draw a sequence in order, each colour named as accessible text and tooltip', () => {
    const swatches = [
      { name: 'red', color: '#d32f2f' },
      { name: 'blue', color: '#1e5bd6' },
    ];
    const cut = {
      ...row,
      key: '1',
      at: 1,
      playerId: null,
      comment: null,
      text: 'red, blue',
      swatches,
    };
    show({
      game: { text: { code: () => null, event: () => null, guesses: () => [cut] } } as never,
    });
    const dots = screen.getAllByRole('img');
    expect(dots.map((d) => d.getAttribute('aria-label'))).toEqual(['red', 'blue']);
    expect(dots.map((d) => d.getAttribute('title'))).toEqual(['red', 'blue']);
    expect(dots[0]?.style.getPropertyValue('--swatch')).toBe('#d32f2f');
  });
});
